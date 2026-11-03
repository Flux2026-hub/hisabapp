const fs = require('fs');
let c = fs.readFileSync('app/index.tsx', 'utf8');
c = c.replace('position: "absolute", top: 0, left: 0, right: 0, zIndex: 4', 'position: "absolute", top: 115, left: 0, right: 0, zIndex: 1');
c = c.replace(/elevation: 8,/g, 'elevation: 10,');
c = c.replace('contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent]}', 'contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent, { paddingTop: 210 }]}');
fs.writeFileSync('app/index.tsx', c);
console.log('✅ تم إصلاح ترتيب الطبقات والمسافات بنجاح!');
