/**
 * French rain forecast inside a Scriptable widget.
 *
 * Created by Johann Pardanaud (https://johann.pardanaud.com/).
 *
 * Homepage: https://github.com/nesk/rain-forecast-widget
 */

//================================================
//=============== DEBUG ZONE START ===============
//================================================

/**
 * Defines the size of the widget in debug mode.
 *
 * @const {(null|"small"|"medium"|"large")}
 */
const DEBUG_PRESENT_SIZE = null

/**
 * Defines the town for which you want the forecast.
 *
 * @const {?string}
 */
const DEBUG_TOWN = null

//================================================
//================ DEBUG ZONE END ================
//================================================

const lang = {
  translations: {
    'title.full': {
      fr: 'Pluie à venir',
      en: 'Rain forecast',
    },
    'title.short': {
      fr: 'Pluie',
      en: 'Rain',
    },
    'minutes': {
      fr: 'minutes',
      en: 'minutes',
    },
    'rain.none': {
      fr: 'Temps sec',
      en: 'Dry weather',
    },
    'rain.light': {
      fr: 'Pluie faible',
      en: 'Light rain',
    },
    'rain.moderate': {
      fr: 'Pluie modérée',
      en: 'Moderate rain',
    },
    'rain.heavy': {
      fr: 'Pluie forte',
      en: 'Heavy rain',
    },
    'rain.unknown': {
      fr: 'Aucune information disponible',
      en: 'No information available',
    },
    'error': {
      fr: 'Une erreur est survenue',
      en: 'An error occurred',
    },
  },

  translate(name) {
    const translation = this.translations[name] || {}
    const availableLanguages = Object.keys(translation)
    const preferredLanguages = Device.preferredLanguages().map(lang => lang.split('-')[0])

    for (const lang of preferredLanguages) {
      if (availableLanguages.includes(lang)) {
        return translation[lang]
      }
    }

    return translation.en || '%UNKNOWN_TRANSLATION%'
  },
}

const title = getWidgetSize() !== 'small' ? lang.translate('title.full') : lang.translate('title.short')
const backgroundColors = [
  Color.dynamic(new Color('#3182CE'), new Color('#2A4365')),
  Color.dynamic(new Color('#4299E1'), new Color('#2C5282')),
]

try {
  const sessionValue = await getSessionValue()
  const jwt = convertSessionValueToJwt(sessionValue)

  let town = args.widgetParameter || DEBUG_TOWN
    ? await getTownInfos(jwt, args.widgetParameter || DEBUG_TOWN)
    : null

  let isCurrentLocation = false
  let location = town
  if (location === null) {
    location = await getCurrentLocation()
    isCurrentLocation = true
  }

  const { update_time: updatedAt, properties: townWithForecast } = await getForecastInfos(jwt, location)
  town = Object.assign(town || {}, townWithForecast)

  if (town.url === undefined) {
    town.url = await getTownInfos(town.name).url
  }

  const { sunrise, sunset } = (await getSunHours(location)) || {}
  const forecast = town.forecast.map(dataPoint => forecastDataPointToSFSymbol(dataPoint, sunrise, sunset))

  applyWidget(createWidget(
    title,
    town.name,
    isCurrentLocation,
    forecast,
    backgroundColors,
    town.url,
    new Date(updatedAt)
  ))
} catch (error) {
  console.error(error)
  applyWidget(createWidget(title, lang.translate('error'), false, [], backgroundColors))
}

function cache() {
  const disk = FileManager.local()
  return {
    disk,
    directory: disk.joinPath(disk.libraryDirectory(), "hourly-weather"),
    _setupDirectory() {
      if (!this.disk.isDirectory(this.directory)) {
        this.disk.createDirectory(this.directory)
      }
    },
    _getPath(key) {
      return `${this.directory}/${key}.json`
    },
    has(key) {
      return this.disk.fileExists(this._getPath(key))
    },
    get(key) {
      try {
        return JSON.parse(this.disk.readString(this._getPath(key)))
      } catch (err) {
        return null
      }
    },
    set(key, value) {
      this._setupDirectory()
      this.disk.writeString(this._getPath(key), JSON.stringify(value))
    },
  }
}

function assertRequestIsSuccessful(request) {
  const { statusCode } = request.response
  if (statusCode !== 200) {
    throw `Unexpected status code ${statusCode}`
  }
}

async function getSessionValue() {
  console.log('Requesting the session value...')
  const request = new Request("https://meteofrance.com")
  await request.load()
  assertRequestIsSuccessful(request)

  const cookie = request.response.cookies.find(({ name }) => name === 'mfsession')
  const sessionValue = cookie !== null ? cookie.value : null

  console.log(`Session value retrieved: ${sessionValue}`)
  return sessionValue
}

function convertSessionValueToJwt(sessionValue) {
  // Extracted from a script from Meteo France
  // See: https://meteofrance.com/sites/meteofrance.com/files/js/js_kzUxSvsVy7NKe1DoZyZTig_IUoshY06Pf7-ist1vhQc.js
  const jwt = sessionValue.replace(/[a-zA-Z]/g, function(e) {
    const t = e <= "Z" ? 65 : 97
    return String.fromCharCode(t + (e.charCodeAt(0) - t + 13) % 26)
  })

  console.log(`Session value converted to JWT: ${jwt}`)
  return jwt
}

async function getCurrentLocation() {
  console.log('Requesting current location...')
  let latitude, longitude = null
  try {
    ({ latitude, longitude } = await Location.current())
    cache().set('location', { latitude, longitude })
  } catch (err) {
    console.log(err)
    console.log('Unable to request the current location, trying the cache...')
    if (cache().has('location')) {
      ({ latitude, longitude } = cache().get('location'))
    } else {
      throw new Error('Unable to retrieve the current location.')
    }
  }
  console.log(`Location retrieved: latitude=${latitude} longitude=${longitude}`)
  return { latitude, longitude }
}

async function getTownInfos(authorizationToken, townName) {
  const endpoint = 'https://meteofrance.com/search/all'

  console.log(`Searching for town "${townName}"...`)
  const request = new Request(`${endpoint}?term=${encodeURIComponent(townName)}`)
  request.headers = { Authorization: `Bearer ${authorizationToken}` }
  const payload = await request.loadString()
  assertRequestIsSuccessful(request)

  const results = JSON.parse(payload)
  const town = results.find(({ type }) => type === 'VILLE_FRANCE')
  if (!town) {
    console.log(`Town "${town.name}" not found.`)
    return null
  }

  const url = `https://meteofrance.com${town.alias}`
  console.log(`Town "${town.name}" found: latitude=${town.lat} longitude=${town.lng} url=${url}`)
  return { latitude: town.lat, longitude: town.lng, url }
}

async function getForecastInfos(authorizationToken, { latitude, longitude }) {
  const endpoint = 'https://rpcache-aa.meteofrance.com/internet2018client/2.0/nowcast/rain'

  console.log('Requesting the latest forecast infos...')
  const request = new Request(`${endpoint}?lat=${latitude}&lon=${longitude}`)
  request.headers = { Authorization: `Bearer ${authorizationToken}` }
  const payload = await request.loadString()
  assertRequestIsSuccessful(request)

  const forecast = JSON.parse(payload)
  const town = forecast.properties

  // Fix naming for Paris (otherwise searching for this town will fail)
  if (town.french_department == 75) {
    const match = town.name.match(/^Paris(\d+)/)
    if (match !== null) {
      town.name = `Paris ${match[1]}e`
    }
  }

  const rainDebug = town.forecast.map(({ rain_intensity }) => rain_intensity)
  console.log(
    `Latest forecast infos retrieved: ` +
    `${town.name} (${town.french_department}) at ${forecast.update_time} = ${rainDebug}`
  )

  return forecast
}

async function getSunHours({ latitude, longitude }) {
  const endpoint = 'https://api.sunrise-sunset.org/json'

  console.log('Requesting the Sun hours...')
  const request = new Request(`${endpoint}?lat=${latitude}&lng=${longitude}&formatted=0`)

  try {
    const { results: { sunrise, sunset} } = await request.loadJSON()
    console.log(`Sun hours: sunrise=${sunrise} sunset=${sunset}`)

    return {
      sunrise: new Date(sunrise),
      sunset: new Date(sunset),
    }
  } catch (error) {
    console.error('Error while requesting the Sun hours.')
    console.error(error)

    return null
  }
}

function forecastDataPointToSFSymbol(dataPoint, sunrise = null, sunset = null) {
  const now = new Date()
  const isNight = sunrise && sunset ? now >= sunset || now < sunrise : false

  switch (dataPoint.rain_intensity) {
    case 1:
      return SFSymbol.named(!isNight ? 'cloud.sun.fill' : 'cloud.moon.fill')
    case 2:
      return SFSymbol.named(!isNight ? 'cloud.sun.rain.fill' : 'cloud.moon.rain.fill')
    case 3:
      return SFSymbol.named('cloud.rain.fill')
    case 4:
      return SFSymbol.named('cloud.heavyrain.fill')
    default:
      const sfSymbol = SFSymbol.named('questionmark.square.dashed')
      sfSymbol.suggestedColor = Color.white()
      return sfSymbol
  }
}

function getFormattedTime(date = new Date()) {
  const formatter = new DateFormatter()
  formatter.useShortTimeStyle()
  return formatter.string(date)
}

function getWidgetSize() {
  if (config.widgetFamily) {
    return config.widgetFamily
  }

  return DEBUG_PRESENT_SIZE
}

function createWidget(title, town, isCurrentLocation, forecast, backgroundColors, url = null, updatedAt = new Date()) {
  const widget = new ListWidget()

  const gradient = new LinearGradient()
  gradient.colors = backgroundColors
  gradient.locations = [0, 1]
  widget.backgroundGradient = gradient

  if (url) {
    widget.url = url
  }

  const headerStack = widget.addStack()
  headerStack.centerAlignContent()

  const titleText = headerStack.addText(title)
  titleText.textColor = Color.white()
  titleText.textOpacity = 0.9
  titleText.font = Font.systemFont(16)

  headerStack.addSpacer(null)

  const locationSymbol = SFSymbol.named(isCurrentLocation ? 'location.fill' : 'location.slash.fill')
  const locationImage = headerStack.addImage(locationSymbol.image)
  locationImage.tintColor = Color.white()
  locationImage.imageOpacity = 0.9
  locationImage.imageSize = new Size(12, 12)

  headerStack.addSpacer(8)

  const refreshImage = headerStack.addImage(SFSymbol.named('arrow.clockwise').image)
  refreshImage.tintColor = Color.white()
  refreshImage.imageOpacity = 0.9
  refreshImage.imageSize = new Size(12, 12)

  headerStack.addSpacer(4)

  const updateText = headerStack.addText(getFormattedTime(updatedAt))
  updateText.textColor = Color.white()
  updateText.textOpacity = 0.9
  updateText.font = Font.systemFont(12)

  widget.addSpacer(5)

  const townText = widget.addText(town)
  townText.textColor = Color.white()
  townText.font = Font.systemFont(22)

  widget.addSpacer(10)

  const timings = [' 5', '10', '15', '20', '25', '30', '40', '50', '60']

  if (getWidgetSize() === 'small') {
    forecast = forecast.slice(0, 4)
  }

  const forecastStack = widget.addStack()
  forecast.forEach((sfSymbol, index) => {
    const dataPointStack = forecastStack.addStack()
    dataPointStack.layoutVertically()

    const dataPointImage = dataPointStack.addImage(sfSymbol.image)
    dataPointImage.resizable = false
    dataPointImage.imageSize = new Size(25, 25)

    dataPointStack.addSpacer(5)

    const textStack = dataPointStack.addStack()
    textStack.addSpacer(5)

    const dataPointText = textStack.addText(timings[index])
    dataPointText.textColor = Color.white()
    dataPointText.textOpacity = 0.9
    dataPointText.font = Font.regularMonospacedSystemFont(getWidgetSize() !== 'small' ? 12 : 11)
    dataPointText.centerAlignText()

    textStack.addSpacer(5)

    if (index + 1 < forecast.length) {
      forecastStack.addSpacer(null)
    }
  })

  if (forecast.length > 0) {
    widget.addSpacer(5)

    const unitsText = widget.addText(lang.translate('minutes'))
    unitsText.textColor = Color.white()
    unitsText.textOpacity = 0.9
    unitsText.font = Font.regularMonospacedSystemFont(12)
    unitsText.centerAlignText()
  }

  if (getWidgetSize() === 'large') {
    widget.addSpacer(25)

    const descriptions = [
      'rain.none',
      'rain.light',
      'rain.moderate',
      'rain.heavy',
      'rain.unknown',
    ]

    for (let i = 1 ; i <= 5 ; i++) {
      const legendStack = widget.addStack()
      legendStack.centerAlignContent()

      const sfSymbol = forecastDataPointToSFSymbol({ rain_intensity: i })
      const sfSymbolImage = legendStack.addImage(sfSymbol.image)
      sfSymbolImage.resizable = false
      sfSymbolImage.imageSize = new Size(25, 25)
      sfSymbolImage.tintColor = sfSymbol.suggestedColor

      legendStack.addSpacer(15)

      const descriptionText = legendStack.addText(lang.translate(descriptions[i - 1]))
      descriptionText.textColor = Color.white()
      descriptionText.textOpacity = 0.9
      descriptionText.font = Font.regularMonospacedSystemFont(12)

      widget.addSpacer(5)
    }
  }

  return widget
}

function applyWidget(widget) {
  Script.setWidget(widget)

  switch (DEBUG_PRESENT_SIZE) {
    case 'small':
      widget.presentSmall()
      break
    case 'medium':
      widget.presentMedium()
      break
    case 'large':
      widget.presentLarge()
      break
  }
}
