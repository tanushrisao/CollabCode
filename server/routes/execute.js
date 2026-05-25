const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

router.post('/', async (req, res) => {
  const { code, language } = req.body;

  if (!code) return res.status(400).json({ error: 'No code provided' });

  const tmpDir = os.tmpdir();
  let filename, command;

  if (language === 'python') {
    filename = path.join(tmpDir, `cc_${Date.now()}.py`);
    command = `python "${filename}"`;
  } else {
    return res.status(400).json({ error: 'Language not supported' });
  }

  fs.writeFileSync(filename, code);

  exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
    fs.unlinkSync(filename);
    res.json({
      stdout: stdout || '',
      stderr: stderr || error?.message || ''
    });
  });
});

module.exports = router;