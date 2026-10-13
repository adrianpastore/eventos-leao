'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const { script } = require('./helpers/carregar');
test('script principal passa node --check (ou compilador VM se sandbox bloquear spawn)', t => {
  const r = spawnSync(process.execPath, ['--check'], { input: script, encoding: 'utf8' });
  if (r.error && r.error.code === 'EPERM') {
    t.diagnostic('spawn EPERM: sintaxe verificada com node:vm.Script, sem executar inicialização.');
    assert.doesNotThrow(() => new vm.Script(script));
    return;
  }
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr);
});
