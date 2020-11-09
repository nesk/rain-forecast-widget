# Rain Forecast Widget

[🇫🇷 Documentation en Français 🇫🇷](./README-FR.md)

An iOS widget displaying precise rain forecast for the next hour. Relies on data provided by [Météo France](https://meteofrance.com/). Works only in France.

# Features

- ☔️ Display of precise rain forecast for the next hour
- 📍 Can use your current location
- 🏙 Allows to configure a specific town to display
- 📏 Handles the three widget sizes
- 🌓 Custom UI for light and dark modes
- 🏴 Available in multiple languages

<p align=center>
  <br>
  <img src="./assets/screenshot.jpg">
</p>

# Installation

- Download the [Scriptable](https://scriptable.app/) app.
- Create a new script inside the app and past the contents of the [script.js](./script.js) file.
- Add a new widget on your iPhone homescreen and select Scriptable.
- Edit the widget parameters and select the name of the script you have created.
- The rain forecast for your current location should displayed on your screen! 🌈

# Configuration

You can choose to display the rain forecast for a specific town by editing the widget parameters and by setting the name of the town you want in the `Parameter` field:

<p align=center>
  <img src="./assets/config.png" height=300>
</p>

If you get an error right after setting the town, check [in the search bar of Météo France](https://meteofrance.com/) (at the top) if the town exists.

# Thanks to

- [Simon B. Støvring](https://twitter.com/simonbs) for creating Scriptable
- [Sunrise-Sunset](https://sunrise-sunset.org/api) for their free API
