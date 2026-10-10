import * as Hetzner from "alchemy/Hetzner";

export const Key = Hetzner.SshKey("omarchy", {
  publicKey:
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKKNDCGdsMAsIma08Hn/XTmmUhXsFBdfN3EdLdEm8pBv hetzner",
});

export const Box = Hetzner.Server("box", {
  serverType: "cx23",
  image: "ubuntu-24.04",
  location: "nbg1",
  sshKeys: [Key],
});
