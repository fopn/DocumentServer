# Build Requisites

## Introduction

To simplify Euro-Office Document Server builds, this project uses Docker under the hood.
You will find instructions below to prepare your build user to run Docker correctly.
This setup is usually done only once per machine.

These Docker instructions are focused on Ubuntu. If you use another OS or distro,
follow the equivalent Docker CE installation steps for your platform.

Be aware of RHEL 8 based distributions. Look for a docker-ce how-to. Installing
the default `docker` package may install `podman` and `buildah`, which do not fully
behave like Docker CE for this workflow.

## Choose a build user

Builds should run with a regular user, not with `root`. That user must be a member
of the `docker` group.

This documentation uses `eobuilder` as an example build user.

Note for advanced users: if you must use `root` for Docker execution, review the
Dockerfiles used in this project and adjust your setup accordingly.

## Docker setup

Note: run these commands as `root` or as a user with `sudo` privileges.

### Install Docker prerequisites

```sh
sudo apt-get update
sudo apt-get remove docker docker-engine docker.io
sudo apt-get install linux-image-extra-$(uname -r) linux-image-extra-virtual
sudo apt-get install apt-transport-https ca-certificates curl software-properties-common
```

### Set up Docker apt repository

```sh
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

sudo tee /etc/apt/sources.list.d/docker.list <<EOM
deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable
EOM

sudo apt-get update
```

### Install Docker

```sh
sudo apt-get install docker-ce
```

## Docker user - Add to group

```sh
sudo usermod -a -G docker eobuilder
```

## Docker user - Re-login

To use Docker correctly from the `eobuilder` user, log out and log back in after
adding the user to the `docker` group.

## Docker user - Hello world

Run Docker's standard hello-world example as `eobuilder`.

If hello-world does not work, builds based on this project's Dockerfiles will not
work either.

## Docker driver setup

Create and select a Buildx container driver, then bootstrap it:

```sh
docker buildx create \
  --name container-builder \
  --driver docker-container \
  --use

docker buildx inspect --bootstrap
```

## Git SSH keys

Note: run these commands as the `eobuilder` user.

Create an SSH key:

```sh
ssh-keygen -t rsa -b 4096 -C "eobuilder@domain.com"
```

Use the email address associated with your GitHub account.

Then upload your public key (`~/.ssh/id_rsa.pub`) to your GitHub profile:
https://github.com/settings/keys

If needed, you can use a dedicated GitHub account for build automation.
