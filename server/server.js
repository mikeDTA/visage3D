// Page + tranchage STL/3MF -> G-code avec PrusaSlicer (CLI)
const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const app = express();
app.use((req, res, next) => { // CORS : autorise la page GitHub Pages à appeler ce serveur
  res.set({ 'Access-Control-Allow-Origin': process.env.ALLOW_ORIGIN || '*',
            'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.get('/', (req, res) => res.send('Serveur de tranchage Visage 3D : OK'));

const KLIPPER_START = 'START_PRINT EXTRUDER_TEMP=[first_layer_temperature] BED_TEMP=[first_layer_bed_temperature]';
// À VÉRIFIER : adapte les macros de démarrage/fin à celles de ta machine (Creality Print).
const PRINTERS = {
  k1:  { bed: [220, 220, 250], flavor: 'klipper', start: KLIPPER_START, end: 'END_PRINT' },
  hi:  { bed: [260, 260, 300], flavor: 'klipper', start: KLIPPER_START, end: 'END_PRINT' },
  x1c: { bed: [256, 256, 256], flavor: 'marlin2',
         start: 'M140 S[first_layer_bed_temperature]\\nM104 S[first_layer_temperature]\\nG28\\nM190 S[first_layer_bed_temperature]\\nM109 S[first_layer_temperature]',
         end: 'M104 S0\\nM140 S0\\nG91\\nG1 Z10\\nG90\\nM84' },
};

function ini(p, o) {
  const [x, y, z] = p.bed, n = o.ext, rep = v => Array(n).fill(v).join(',');
  return [
    `bed_shape = 0x0,${x}x0,${x}x${y},0x${y}`, `max_print_height = ${z}`,
    `gcode_flavor = ${p.flavor}`, `nozzle_diameter = ${rep(0.4)}`, `filament_diameter = ${rep(1.75)}`,
    `layer_height = ${o.layer}`, `first_layer_height = 0.2`,
    `perimeters = 3`, `top_solid_layers = 5`, `bottom_solid_layers = 4`,
    `fill_density = ${o.infill}%`, `support_material = ${o.support ? 1 : 0}`,
    `temperature = ${rep(o.temp)}`, `first_layer_temperature = ${rep(o.temp)}`,
    `bed_temperature = ${rep(60)}`, `first_layer_bed_temperature = ${rep(60)}`,
    `wipe_tower = ${n > 1 ? 1 : 0}`,
    `start_gcode = ${p.start}`, `end_gcode = ${p.end}`,
  ].join('\n');
}

let busy = 0;
app.post('/api/slice', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  const p = PRINTERS[req.query.printer];
  if (!p) return res.status(400).send('Imprimante inconnue');
  if (!Buffer.isBuffer(req.body) || req.body.length < 84) return res.status(400).send('Modèle manquant');
  if (busy >= 2) return res.status(503).send('Serveur occupé, réessaie dans un instant');
  const num = (v, d, a, b) => Math.min(b, Math.max(a, Number(v) || d));
  const opts = {
    layer: num(req.query.layer, 0.2, 0.08, 0.3), infill: num(req.query.infill, 15, 0, 100),
    temp: num(req.query.temp, 215, 180, 280), support: req.query.support === '1',
    ext: Math.round(num(req.query.extruders, 1, 1, 4)),
  };
  const is3mf = req.body.subarray(0, 2).toString() === 'PK';
  busy++;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'slice-'));
  try {
    const model = path.join(dir, is3mf ? 'model.3mf' : 'model.stl');
    const cfg = path.join(dir, 'conf.ini'), out = path.join(dir, 'out.gcode');
    await fs.writeFile(model, req.body);
    await fs.writeFile(cfg, ini(p, opts));
    await new Promise((ok, ko) => execFile('xvfb-run',
      ['-a', 'prusa-slicer', '--export-gcode', '--load', cfg, '--output', out, model],
      { timeout: 240000 }, (e, so, se) => (e ? ko(new Error(se || so || e.message)) : ok())));
    res.type('text/plain').send(await fs.readFile(out));
  } catch (e) {
    res.status(500).send('Échec du tranchage : ' + e.message.slice(0, 500));
  } finally {
    busy--; fs.rm(dir, { recursive: true, force: true });
  }
});
app.listen(process.env.PORT || 8080);
