# Razer Naga V3 Pro — SignalRGB Community Plugins (v1.0)

Free community-developed SignalRGB plugins for the Razer Naga V3 Pro. Two independent files let users enable or disable wired and wireless support separately. No GitHub account, registration, or payment is required for these plugin files.

## Included files

- `Razer_Naga_V3_Pro_Wired.js` — USB connection, product ID `0x00E7`
- `Razer_Naga_V3_Pro_Wireless.js` — 2.4 GHz dongle, product ID `0x00E8`

## Features

- Three independently movable lighting zones: Side Panel, Scroll Wheel, and Logo
- Individual zone brightness using SignalRGB's built-in Device Brightness controls
- Automatic lighting recovery after sleep/wake, as tested on the developer's setup
- No forced software/driver mode, helping preserve onboard profiles, custom keybinds, and the physical profile button
- Optional DPI and polling-rate overrides; both default to **Onboard Profile**
- Wireless battery monitoring

## Installation

1. Fully exit SignalRGB and back up any existing Naga V3 Pro plugin files.
2. Remove or disable previous unified/experimental Naga V3 Pro plugins to avoid duplicate device matches.
3. Extract the ZIP and copy either or both `.js` files (not the ZIP itself) into the SignalRGB custom plugin folder on Windows:

   `%USERPROFILE%\WhirlwindFX\Plugins` or `%USERPROFILE%\Documents\WhirlwindFX\Plugins`

   To open it, press **Win + R**, paste the path above, and press **Enter**. Create the `Plugins` folder if it does not already exist. If you configured a different plugin location, use that location instead.
4. Restart SignalRGB. Open **Lighting → Layouts** and move the Side Panel, Scroll Wheel, and Logo zones apart if they initially overlap.
5. Confirm lighting, custom keybinds, profile button, and sleep/wake behavior before changing optional performance settings.

## Important compatibility notes

**Razer Synapse:** Developed and tested with Razer Synapse **completely closed**, not just minimized to the system tray. Simultaneous operation with Synapse has not been validated and may cause device-control conflicts. Synapse need not be uninstalled; it can still be used separately to configure onboard profiles.

**Two devices:** When the USB cable and wireless dongle are both connected, SignalRGB may display both wired and wireless device entries. Disable whichever entry you do not want to use.

**Battery icon:** The wireless device's battery indicator may retain its last known reading or show `?` when the wireless connection is inactive. SignalRGB's device settings can hide the indicator; disabling the wireless device also removes it.

**DPI/polling overrides:** The default **Onboard Profile** selection does not intentionally change these settings. Selecting an override may require switching hardware profiles or power-cycling the mouse to restore the previous onboard value.

**Testing:** Developed and used on Windows 11 with SignalRGB 2.5.86. Other environments and simultaneous Synapse operation have not been validated.

## Sharing and support

These plugins are provided **free of charge** as a community contribution. They are offered **as-is, without warranty or a commitment to ongoing maintenance**. Others are welcome to study, modify, and improve the original contributions, subject to any applicable third-party rights.

The work used SignalRGB / WhirlwindFX's existing Razer mouse implementation as a technical reference. This is an unofficial community release and is not endorsed by SignalRGB, WhirlwindFX, or Razer. No claim is made that third-party code or materials are copyright-free or dedicated to the public domain. Any applicable third-party rights and notices remain with their respective owners.

Feedback may be shared through the SignalRGB community or support channels. SignalRGB's maintainers are welcome to review the implementation for potential integration into their official Razer mouse support, subject to applicable rights and their contribution process.
