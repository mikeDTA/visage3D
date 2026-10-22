// Lancé par GitHub Actions : tranche chaque job déposé dans jobs/ avec PrusaSlicer -> output/<id>.gcode
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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


const num = (v, d, a, b) => Math.min(b, Math.max(a, Number(v) || d));
fs.mkdirSync('output', { recursive: true });
const files = fs.existsSync('jobs') ? fs.readdirSync('jobs').filter(f => /^[a-z0-9]+\.json$/.test(f)) : [];
for (const f of files) {
  const id = path.basename(f, '.json');
  try {
    const j = JSON.parse(fs.readFileSync(path.join('jobs', f), 'utf8'));
    const p = PRINTERS[j.printer];
    if (!p) throw new Error('Imprimante inconnue');
    const model = path.join('jobs', id + (j.ext === '3mf' ? '.3mf' : '.stl'));
    const cfg = path.join('/tmp', id + '.ini');
    fs.writeFileSync(cfg, ini(p, {
      layer: num(j.layer, 0.2, 0.08, 0.3), infill: num(j.infill, 15, 0, 100), temp: 215,
      support: false, ext: Math.round(num(j.extruders, 1, 1, 4)),
    }));
    execFileSync('xvfb-run', ['-a', 'prusa-slicer', '--export-gcode', '--load', cfg,
      '--output', path.join('output', id + '.gcode'), model], { timeout: 300000, stdio: 'pipe' });
  } catch (e) {
    fs.writeFileSync(path.join('output', id + '.error.txt'),
      'Échec du tranchage : ' + String(e.stderr || e.message).slice(0, 500));
  }
  for (const ext of ['json', 'stl', '3mf']) fs.rmSync(path.join('jobs', id + '.' + ext), { force: true });
}

