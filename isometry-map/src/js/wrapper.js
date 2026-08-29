var map = L.map('map', {
  scrollWheelZoom: true,
  wheelPxPerZoomLevel: 180,
  wheelDebounceTime: 50,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
}).setView([32.5, 38.5], 5)

L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 16,
    attribution:
      'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  },
).addTo(map)

L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 16,
  },
).addTo(map)

var activeHighlight = null
var activeHighlightKey = null
var geoJsonLayer
var countryLayers = {}
var groupDefinitions = {
  hittites: {
    label: 'Великая Хеттская Империя',
    names: ['Hittites', 'Egypt', 'Kingdom of David and Solomon'],
  },
  eastern: {
    label: 'Восточный Союз',
    names: ['Assyria', 'Babylonia', 'Elam'],
  },
}

function getFeatureStyle(feature) {
  var name = feature.properties.NAME
  var f = factionStyle[name] || { color: '#999' }
  var isActive = !!activeHighlight && activeHighlight.indexOf(name) !== -1
  var isDimmed = !!activeHighlight && !isActive

  return {
    color: f.color,
    weight: isActive ? 3 : 2,
    fillColor: f.color,
    fillOpacity: isDimmed ? 0.08 : 0.35,
    opacity: isDimmed ? 0.35 : 1,
  }
}

function updateHighlightStyles() {
  if (!geoJsonLayer) {
    return
  }
  geoJsonLayer.eachLayer((layer) => {
    if (layer.feature) {
      layer.setStyle(getFeatureStyle(layer.feature))
    }
  })
}

geoJsonLayer = L.geoJSON(bronzeAgeGeoJSON, {
  style: getFeatureStyle,
  onEachFeature: function (feature, layer) {
    var name = feature.properties.NAME
    var f = factionStyle[name] || { label: name, note: '' }
    countryLayers[f.label] = layer
    countryLayers[name] = layer
    layer.bindTooltip(f.label, {
      permanent: true,
      direction: 'center',
      className: 'map-label country-label',
    })
    layer.bindPopup(`<b>${f.label}</b><br><span class='popup-note'>${f.note}</span>`)
  },
}).addTo(map)
updateHighlightStyles()

cities.forEach((c) => {
  L.circleMarker(c.coords, {
    radius: 6,
    color: '#222',
    weight: 1,
    fillColor: '#fff',
    fillOpacity: 1,
  })
    .addTo(map)
    .bindTooltip(c.name, {
      permanent: true,
      direction: 'top',
      className: 'map-label city-label',
    })
    .bindPopup(`<b>${c.name}</b><br>${c.note}`)
})

var legend = L.control({ position: 'bottomright' })
legend.onAdd = function () {
  var div = L.DomUtil.create('div', 'legend')
  var rows = ''
  var seen = {}
  var groupButtonsHtml = ''

  Object.keys(groupDefinitions).forEach((key) => {
    var g = groupDefinitions[key]
    groupButtonsHtml += `<button class="legend-group-button" type="button" data-group="${key}">${g.label}</button>`
  })

  Object.keys(factionStyle).forEach((key) => {
    var f = factionStyle[key]
    if (seen[f.label]) {
      return
    }
    seen[f.label] = true
    rows +=
      `<button class="legend-item" type="button" data-label="${encodeURIComponent(f.label)}">` +
      `<span class="swatch" style="background:${f.color}"></span>${f.label}</button>`
  })
  div.innerHTML = `<div class="legend-group-buttons">${groupButtonsHtml}</div>${
    rows
  }<div class="note">Alternative historical world map for 1000 BCE</div>`
  div.addEventListener('click', (e) => {
    var groupButton = e.target.closest('button.legend-group-button')
    if (groupButton) {
      var groupKey = groupButton.dataset.group
      if (activeHighlightKey === groupKey) {
        activeHighlight = null
        activeHighlightKey = null
      } else {
        activeHighlight = groupDefinitions[groupKey].names
        activeHighlightKey = groupKey
      }
      updateHighlightStyles()
      Array.from(div.querySelectorAll('button.legend-group-button')).forEach((button) => {
        button.classList.toggle('active', button.dataset.group === activeHighlightKey)
      })

      return
    }

    var button = e.target.closest('button.legend-item')
    if (!button) {
      return
    }
    var label = decodeURIComponent(button.dataset.label)
    var layer = countryLayers[label]
    if (!layer) {
      return
    }
    map.fitBounds(layer.getBounds(), { maxZoom: 7, padding: [20, 20] })
    layer.openPopup()
  })

  return div
}
legend.addTo(map)
