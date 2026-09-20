{
  description = "Live markdown preview from the terminal, rendered by pixel";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };

        # exclude dev-only cruft (in particular node_modules) from the source
        src = builtins.path {
          path = ./.;
          name = "mdbrowse-src";
          filter =
            path: _type:
            let
              base = baseNameOf path;
            in
            base != "node_modules" && base != ".git";
        };

        # @zenbu-labs/pixel's own postinstall script downloads a patched
        # Electron build from GitHub releases, which can't happen inside the
        # sandboxed nix build. Fetch it here instead, as an ordinary
        # fixed-output derivation, and stage it into place ourselves
        # (postConfigure below) with npm's install scripts turned off.
        pixelElectronVersion = "44.2.0";
        pixelElectronPlatform =
          {
            x86_64-linux = "linux-x64";
            aarch64-linux = "linux-arm64";
            x86_64-darwin = "darwin-x64";
            aarch64-darwin = "darwin-arm64";
          }
          .${system} or (throw "mdbrowse: @zenbu-labs/pixel has no patched Electron build for ${system}");
        pixelElectronHash =
          {
            linux-x64 = "49c73c92804da293c75ff7e41469a7513d0217a4d37332054977075eb42615d9";
            linux-arm64 = "c276f54e889aee9ef14a628f9ebe2fa74a734c1ceb376372204ac3406fa5e35f";
            darwin-x64 = "85d8b3ce20505f6f05fccaf0ea286fe54a836df2f65ca82c98c6d5d0569e1794";
            darwin-arm64 = "53b0771e3e49513b6f107db320a8c4bd67025ee2857607b83527aaae34284ec0";
          }
          .${pixelElectronPlatform};
        # fetchurl (not fetchzip) so the hash matches the checksum GitHub
        # actually publishes for this release, verified straight against the
        # zip bytes; unzipping happens ourselves in postConfigure below.
        pixelElectronZip = pkgs.fetchurl {
          url = "https://github.com/zenbu-labs/pixel/releases/download/electron-v${pixelElectronVersion}/electron-v${pixelElectronVersion}-${pixelElectronPlatform}.zip";
          sha256 = pixelElectronHash;
        };

        # The release build is a generic-glibc-distro binary, not linked
        # against the nix store: left unpatched, its "pixel" binary can dlopen
        # nothing outside a handful of paths that don't exist on NixOS, so its
        # GPU process fails every launch and Chromium hard-exits once it hits
        # its crash-retry limit ("GPU process isn't usable. Goodbye."). This
        # is the same interpreter/rpath fix nixpkgs applies to its own
        # electron-bin releases (pkgs/development/tools/electron/binary).
        electronLibPath = pkgs.lib.makeLibraryPath (
          with pkgs;
          [
            alsa-lib
            at-spi2-atk
            cairo
            cups
            dbus
            expat
            gdk-pixbuf
            glib
            gtk3
            gtk4
            nss
            nspr
            libx11
            libxcb
            libxcomposite
            libxdamage
            libxext
            libxfixes
            libxrandr
            libxkbfile
            pango
            pciutils
            stdenv.cc.cc
            systemd
            libnotify
            pipewire
            libsecret
            libpulseaudio
            speechd-minimal
            libdrm
            libgbm
            libxkbcommon
            libxshmfence
            libGL
            vulkan-loader
          ]
        );

        mdbrowse = pkgs.buildNpmPackage {
          pname = "mdbrowse";
          version = "0.1.0";
          inherit src;
          nodejs = pkgs.nodejs_22;
          nativeBuildInputs = [
            pkgs.unzip
            pkgs.patchelf
          ];

          npmDepsHash = "sha256-K09Kj+tkROUBb5FFjH5bY3qub3NiyZD2ux2uYM/ORBk=";
          # No lifecycle scripts anywhere in the tree: @zenbu-labs/pixel's
          # postinstall would otherwise try (and fail) to reach the network.
          npmFlags = [ "--ignore-scripts" ];
          dontNpmBuild = true;

          postConfigure = ''
            electronDist=node_modules/@zenbu-labs/pixel/electron/dist
            mkdir -p "$electronDist"
            unzip -q ${pixelElectronZip} -d "$electronDist"
            # only its existence is checked, not its contents
            echo -n "${pixelElectronHash}" > "$electronDist/.zenbu-electron-sha256"
          '';

          # Patching in postFixup, not postConfigure: the standard fixupPhase
          # runs shrinkRPath in between, which strips any rpath entry not
          # needed by a binary's *static* DT_NEEDED. Chromium's ANGLE loads
          # libEGL/libGL by dlopen() at runtime rather than linking them
          # directly, so setting this any earlier just gets stripped back out
          # (confirmed: still crashed, but on libEGL.so.1 instead of glib).
          postFixup = ''
            electronDistOut="$out/lib/node_modules/mdbrowse/node_modules/@zenbu-labs/pixel/electron/dist"
            patchelf \
              --set-interpreter "$(cat "$NIX_CC/nix-support/dynamic-linker")" \
              --set-rpath "${electronLibPath}:$electronDistOut" \
              "$electronDistOut/pixel" \
              "$electronDistOut/chrome_crashpad_handler"
          '';

          meta = {
            description = "Live markdown preview from the terminal, via pixel";
            license = pkgs.lib.licenses.mit;
            mainProgram = "mdbrowse";
          };
        };
      in
      {
        packages = {
          default = mdbrowse;
          mdbrowse = mdbrowse;
        };

        apps.default = {
          type = "app";
          program = "${mdbrowse}/bin/mdbrowse";
        };

        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
          ];
          shellHook = ''
            echo "mdbrowse dev shell"
            echo "  cd build && npm install && npm run build   # rebuild assets/vendor"
          '';
        };
      }
    );
}
