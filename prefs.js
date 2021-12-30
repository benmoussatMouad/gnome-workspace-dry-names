/**
 * Code diplucated from Improved Workspace Indicator
 */

"use strict";

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const Config = imports.misc.config;
const ShellVersion = parseFloat(Config.PACKAGE_VERSION);

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function init() {}

function buildPrefsWidget() {
  this.settings = ExtensionUtils.getSettings();
  let prefsWidget;

  // gtk4 apps do not have a margin property
  if (ShellVersion >= 40) {
    prefsWidget = new Gtk.Grid({
      margin_start: 18,
      margin_end: 18,
      margin_top: 18,
      margin_bottom: 18,
      column_spacing: 12,
      row_spacing: 12,
    });
  } else {
    prefsWidget = new Gtk.Grid({
      margin: 18,
      column_spacing: 12,
      row_spacing: 12,
    });
  }

  let title = new Gtk.Label({
    label: "<b>Workspace Dry Names Preferences</b>",
    halign: Gtk.Align.START,
    use_markup: true,
  });

  prefsWidget.attach(title, 0, 0, 2, 1);

  // Name option choser

  let name_options_label = new Gtk.Label({
    label: "Names Option",
    halign: Gtk.Align.START,
  });

  let name_options_combo = new Gtk.ComboBoxText();
  name_options_combo.append("cities", "Cities");
  name_options_combo.append("countries", "Countries");
  name_options_combo.append("films", "Films");
  name_options_combo.append("boy_names", "Boy Names");
  name_options_combo.append("girl_names", "Girl Names");
  name_options_combo.append("objects", "Objects");
  name_options_combo.append("funnyWords", "Funny Words");




  name_options_combo.active_id = this.settings.get_string("name-option");

  prefsWidget.attach(name_options_label, 0, 1, 2, 1);
  prefsWidget.attach(name_options_combo, 2, 1, 2, 1);

  this.settings.bind(
    "name-option",
    name_options_combo,
    "active_id",
    Gio.SettingsBindFlags.DEFAULT
  );

  // only gtk3 apps need to run show_all()
  if (ShellVersion < 40) {
    prefsWidget.show_all();
  }

  return prefsWidget;
}
