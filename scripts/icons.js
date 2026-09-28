// 빌드 시 icon.svg → 홈 화면용 PNG 아이콘 생성
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const dir = path.join(__dirname, '..', 'public');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'));
for (const size of [180, 192, 512]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), png);
  console.log(`icon-${size}.png`, png.length);
}
