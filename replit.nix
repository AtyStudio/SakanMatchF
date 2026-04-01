{pkgs}: {
  deps = [
    pkgs.fontconfig
    pkgs.freetype
    pkgs.mesa
    pkgs.dbus
    pkgs.at-spi2-core
    pkgs.alsa-lib
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.cairo
    pkgs.pango
    pkgs.gtk3
    pkgs.gdk-pixbuf
    pkgs.cups
    pkgs.atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
  ];
}
