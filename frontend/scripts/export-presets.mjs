// Prints the preset areas as JSON (input for build_preset_data.py).
const { PRESETS } = await import('../src/presets.ts')
console.log(JSON.stringify(PRESETS.map(({ id, name, geometry }) => ({ id, name, geometry }))))
