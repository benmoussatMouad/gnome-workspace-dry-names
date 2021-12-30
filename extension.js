/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const GETTEXT_DOMAIN = 'workspace-dry-names';
const PERMISSIONS_MODE = 0o744;


const { GObject, St, Clutter } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;


const _ = ExtensionUtils.gettext;

const workspaceManager = global.workspace_manager;

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Workspace Names'));
        
        this._currentName = "";
        this._names = [];
        this.settings = ExtensionUtils.getSettings();
        
        //this._setNamesForExistingWorkspaces();

        //Building the button
        this._textLabel = new St.Label({
            text: "Initial",
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.actor.add_actor(this._textLabel);

        //Building button
        this._randomizeButton = new PopupMenu.PopupMenuItem(_("Random Name"));
        
        this._randomizeButton.actor.insert_child_at_index(new St.Icon({
            icon_name: 'reload',
            style_class: 'popup-menu-icon'
        }), 1);
        
        //Building the name entry widget
        this._entryItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });
        this._nameEntry = new St.Entry({
            name: 'searchEntry',
            can_focus: true,
            hint_text: _('Enter new name'),
            track_hover: true,
            x_expand: true,
            y_expand: true
        });

        //Connect signal for name changes
        this._nameEntry.get_clutter_text().connect(
            'text-changed',
            Lang.bind(this, this._onNameEntryChange)
        );

        this._entryItem.add(this._nameEntry);
        this.menu.addMenuItem(this._entryItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._randomizeButton);
        this._randomizeButton.connect("activate", this._getNewNameForCurrent.bind(this));        

    }

    //Initial names from dconf value
    _initNames() {
        let settings = ExtensionUtils.getSettings("org.gnome.desktop.wm.preferences");
        let workspaceNames = settings.get_strv("workspace-names");

        for(let i = 0; i<workspaceNames.length; i++) {
            this._names[i] = workspaceNames[i];
        }
    }


    //Save names into dconf value
    _saveNames() {
        let settings = ExtensionUtils.getSettings("org.gnome.desktop.wm.preferences");
        settings.set_strv("workspace-names", this._names);
    }

    _getNewNameForCurrent() {
        let currentIndex = workspaceManager.get_active_workspace_index();
        let indicator = this;

        this._getNames(1, function (_httpSession, message) {
            if (message.status_code !== 200)
                return;

            let json = JSON.parse(message.response_body.data);
            indicator._changeWorkspaceName(currentIndex, json[0].replace(/_/g, " "));
            indicator._displayWorkspaceName();

        });
    }

    _onNameEntryChange() {
        let entredName = this._nameEntry.get_text();

        this._changeWorkspaceName(workspaceManager.get_active_workspace_index(), entredName);
        this._displayWorkspaceName();
    }   

    _refreshName() {
        this._textLabel.set_text(_(`${this._currentName}`));
    }

    _displayWorkspaceName() {
        let active_index = workspaceManager.get_active_workspace_index();
        this._currentName = this._names[active_index]
        this._refreshName();
    }


    _getNames(numberOfNames, callback) {

        // For reference : http://names.drycodes.com/
        let params = {
            nameOptions: this.settings.get_string('name-option'),
            combine: '1',
        };
        const URL = 'http://names.drycodes.com/' + numberOfNames;
        
        // new sesssion
        let _httpSession = new Soup.Session();
    
        // create http request:
        // method (GET, POST, ...)
        // URL
        // request parameters
        let message = Soup.form_request_new_from_hash('GET', URL, params);
         
        // execute the request and define the callback
        _httpSession.queue_message(message, Lang.bind(this, callback));
    }

    

    _setNewWorkspaceName() {
        let lastWorkspaceIndex = workspaceManager.get_n_workspaces();
        let indicator = this;

        if(indicator._names[lastWorkspaceIndex] == null) {
            indicator._getNames(1, function (_httpSession, message) {
                if (message.status_code !== 200)
                    return;
    
                let json = JSON.parse(message.response_body.data);
                indicator._changeWorkspaceName(lastWorkspaceIndex, json[0].replace(/_/g, " "))
            });
            
        }
    }

    _changeWorkspaceName(index, name) {
        this._names[index] = name;
        this._saveNames();
    }

    destroy_children() {
        this._textLabel.destroy();
        this._entryItem.destroy();
        this._randomizeButton.destroy();
    }
});

class Extension {
    constructor() {
        this._indicator = null;
    }

    connectWorkspaceSignals() {

        this._workspaceSwitchedId = workspaceManager.connect_after(
            "workspace-switched",
            this._indicator._displayWorkspaceName.bind(this._indicator)
          );

        this._workspaceAddedId = workspaceManager.connect_after(
        "workspace-added",
        this._indicator._setNewWorkspaceName.bind(this.indicator)
        );

    }

    disconnectWorkspaceSignals() {
        workspaceManager.disconnect(this._workspaceAddedId);
        workspaceManager.disconnect(this._workspaceSwitchedId);
    }
    enable() {

        let gschema = Gio.SettingsSchemaSource.new_from_directory(
            Me.dir.get_child("schemas").get_path(),
            Gio.SettingsSchemaSource.get_default(),
            false
          );

        this._indicator = new Indicator();
        this._indicator._initNames();

        Main.panel.addToStatusArea("workspace-name-indicator", this._indicator, 1, "left");
        this._indicator._displayWorkspaceName();

        this.connectWorkspaceSignals();
    }

    disable() {
       this.disconnectWorkspaceSignals();
       this._indicator.destroy_children();
        this._indicator.destroy();
        this._indicator = null;
    }

    
}

function init() {
    ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    return new Extension();
}