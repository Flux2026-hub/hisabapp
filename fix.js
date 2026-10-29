const fs = require('fs');
const path = require('path');
function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) {
      let c = fs.readFileSync(p, 'utf8');
      if (c.includes('->')) {
        c = c.split('->').join('-&gt;');
        fs.writeFileSync(p, c);
        console.log('✅ Fixed:', p);
      }
    }
  });
}
walk('src');
