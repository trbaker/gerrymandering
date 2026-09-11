// Runs after the ArcGIS SDK module (deferred scripts execute in document order).
// If the SDK can't load (offline or blocked network), use the built-in SVG map.
(async function start(){
  try{
    if(!window.$arcgis) throw new Error('ArcGIS SDK unavailable');
    boot(await makeArcgisRenderer(), 'Map: <b>ArcGIS Online</b> · basemap by Esri · districts: U.S. Census Bureau / Esri Living Atlas');
  }catch(err){
    console.warn('ArcGIS unavailable, using SVG fallback:', err);
    document.getElementById('map-host').innerHTML='';
    boot(makeSvgRenderer(), 'Map: <b>offline mode</b> (ArcGIS Online could not be reached)');
  }
})();
