pkgname=mcp-router-git
_pkgname=mcp-router
pkgver=0
pkgrel=1
pkgdesc="A unified MCP server management desktop app (development build)"
arch=('x86_64')
url="https://github.com/mcp-router/mcp-router"
license=('custom:Sustainable-Use')
depends=(
  'alsa-lib'
  'atk'
  'cairo'
  'dbus'
  'freetype2'
  'glib2'
  'gtk3'
  'hicolor-icon-theme'
  'libdrm'
  'libevent'
  'libsecret'
  'libx11'
  'libxcb'
  'libxcomposite'
  'libxcursor'
  'libxdamage'
  'libxext'
  'libxfixes'
  'libxi'
  'libxkbcommon'
  'libxrandr'
  'libxtst'
  'libxss'
  'mesa'
  'nss'
  'pango'
  'xdg-utils'
)
makedepends=('git' 'nodejs>=20' 'pnpm' 'python')
provides=('mcp-router')
conflicts=('mcp-router')
options=('!strip')
source=("mcp-router.desktop"
        "mcp-router.sh"
        "git+https://github.com/${_pkgname}/${_pkgname}.git")
sha256sums=('c988554cfff8ac836d710260d3129213675be8ab27ba077128f8f37b44af2d69'
            'a96481a7c2ce9abba33c436d3725e996e4de19318a0fa90bccdea735e43de759'
            'SKIP')

pkgver() {
  cd "${srcdir}/${_pkgname}"
  git describe --long --tags --match 'v*' | sed 's/^v//; s/\([^-]*-g\)/r\1/; s/-/./g'
}

prepare() {
  cd "${srcdir}/${_pkgname}"
  export PLAYWRIGHT_BROWSERS_PATH=0
  export HUSKY=0
  pnpm install --frozen-lockfile
  pnpm --filter @mcp_router/shared run build
  pnpm --filter @mcp_router/ui run build
  pnpm --filter @mcp_router/remote-api-types run build
}

build() {
  cd "${srcdir}/${_pkgname}"
  export NODE_ENV=production
  pnpm --filter @mcp_router/electron run package
}

package() {
  cd "${srcdir}/${_pkgname}"
  install -d "${pkgdir}/opt/mcp-router"
  cp -r apps/electron/out/MCP\ Router-linux-x64/* "${pkgdir}/opt/mcp-router/"

  install -Dm755 "${srcdir}/mcp-router.sh" "${pkgdir}/usr/bin/mcp-router"
  install -Dm644 "${srcdir}/mcp-router.desktop" "${pkgdir}/usr/share/applications/mcp-router.desktop"

  install -Dm644 apps/electron/public/images/icon/icon.png \
    "${pkgdir}/usr/share/pixmaps/mcp-router.png"

  for size in 16 32 48 64 128 256 512; do
    install -Dm644 apps/electron/public/images/icon/icon.png \
      "${pkgdir}/usr/share/icons/hicolor/${size}x${size}/apps/mcp-router.png"
  done

  install -Dm644 LICENSE.md "${pkgdir}/usr/share/licenses/${pkgname}/LICENSE"
}
