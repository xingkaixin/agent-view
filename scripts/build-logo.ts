import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// SVG 文件路径
const svgPath = path.join(process.cwd(), 'public/logo.svg');

// 需要生成的尺寸
const sizes = [
  { name: 'logo.png', size: 120 },
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon.png', size: 32 },
  { name: 'logo-192x192.png', size: 192 },
  { name: 'logo-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function generateLogos() {
  try {
    // 检查 SVG 文件是否存在
    if (!fs.existsSync(svgPath)) {
      console.error(`❌ 错误: 未找到 ${svgPath}`);
      process.exit(1);
    }

    // 确保读取 SVG 文件
    const svgBuffer = fs.readFileSync(svgPath);
    const publicDir = path.join(process.cwd(), 'public');

    console.log('🎨 正在从 public/logo.svg 生成 Logo 和 Favicon...\n');

    // 为每个尺寸生成 PNG
    for (const { name, size } of sizes) {
      await sharp(svgBuffer, { density: 300 })
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({
          quality: 100,
          compressionLevel: 9,
        })
        .toFile(path.join(publicDir, name));

      console.log(`✅ 生成 ${name} (${size}x${size})`);
    }

    // 生成 favicon.ico (使用 16x16 和 32x32 组合)
    console.log('\n📦 生成 favicon.ico...');
    const favicon16 = await sharp(svgBuffer, { density: 300 })
      .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    
    const favicon32 = await sharp(svgBuffer, { density: 300 })
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    // sharp 不直接支持 ico，这里用 32x32 的 png 复制一份
    fs.copyFileSync(path.join(publicDir, 'favicon-32x32.png'), path.join(publicDir, 'favicon.ico'));
    console.log('✅ 生成 favicon.ico\n');

    console.log('🎉 所有文件生成完成！');
    console.log('\n📁 生成的文件:');
    sizes.forEach(({ name }) => {
      console.log(`  • ${name}`);
    });
    console.log('  • favicon.ico');

  } catch (error) {
    console.error('❌ 生成 logo 时出错:', error);
    process.exit(1);
  }
}

generateLogos();
