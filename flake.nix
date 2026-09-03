{
  description = "Live markdown preview from the terminal, rendered by terminal-browser";

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

        # exclude dev-only cruft (in particular build/node_modules) from the source
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

        mdbrowse = pkgs.stdenvNoCC.mkDerivation {
          pname = "mdbrowse";
          version = "0.1.0";
          inherit src;
          nativeBuildInputs = [ pkgs.makeWrapper ];

          dontBuild = true;
          installPhase = ''
            runHook preInstall

            mkdir -p "$out/share/mdbrowse"
            cp -r assets bin "$out/share/mdbrowse/"
            makeWrapper ${pkgs.nodejs_22}/bin/node "$out/bin/mdbrowse" \
              --add-flags "$out/share/mdbrowse/bin/mdbrowse.mjs"

            runHook postInstall
          '';

          meta = {
            description = "Live markdown preview from the terminal, via terminal-browser";
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
