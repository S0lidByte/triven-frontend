<p align="center">
  <img src="https://github.com/S0lidByte/CineFlow/blob/main/assets/Cineflow-Logo.png" alt="CineFlow" width="300">
</p>

<p align="center">
  CineFlow is a modern media automation platform designed to stream torrent-based media directly to your media server using Debrid providers and integrations with popular third-party services.
</p>

<p align="center">
  Built with performance, flexibility, and automation in mind.
</p>

---

## About

CineFlow began as a fork of  
<a href="https://github.com/rivenmedia/riven" target="_blank" rel="noopener noreferrer">Riven</a>.

While inspired by the original project and its contributors, CineFlow continues development with a new vision, expanded capabilities, and a focus on reliability, modular integrations, and long-term maintainability.

We thank the original Riven developers for their work and contributions to the ecosystem.

---

<div align="center">

<a href="https://github.com/S0lidByte/CineFlow/stargazers">
<img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/S0lidByte/CineFlow">
</a>

<a href="https://github.com/S0lidByte/CineFlow/issues">
<img alt="Issues" src="https://img.shields.io/github/issues/S0lidByte/CineFlow">
</a>

<a href="https://github.com/S0lidByte/CineFlow/blob/main/LICENSE">
<img alt="License" src="https://img.shields.io/github/license/S0lidByte/CineFlow">
</a>

<a href="https://github.com/S0lidByte/CineFlow/graphs/contributors">
<img alt="Contributors" src="https://img.shields.io/github/contributors/S0lidByte/CineFlow">
</a>

<a href="https://todo">
<img alt="Discord" src="https://img.shields.io/badge/Discord-Community-blue">
</a>

</div>

---

## Supported Services

| Type | Supported |
|-----|-----------|
| **Debrid Providers** | Real Debrid, All Debrid |
| **Content Sources** | Plex Watchlist, Overseerr, Mdblist, Listrr, Trakt |
| **Scrapers** | Comet, Jackett, Torrentio, Orionoid, Mediafusion, Prowlarr, Zilean, Rarbg |
| **Media Servers** | Plex, Jellyfin, Emby |

---

<p align="center">
  Track development progress on our
  <a href="todo">Project Board</a>.
</p>

<p align="center">
  Found a bug or want to request a feature?  
  Open an issue on our
  <a href="https://github.com/S0lidByte/CineFlow/issues">Issue Tracker</a>
  or join the discussion on
  <a href="https://todo">Discord</a>.
</p>

<p align="center">
  CineFlow is actively developed with regular improvements, new integrations, and performance enhancements.
</p>

---

# Table of Contents

- [Self Hosted](#self-hosted)
  - [Installation](#installation)
  - [Plex](#plex)
- [CineFlow VFS and Caching](#cineflow-vfs-and-caching)
- [Contributing](#contributing)
- [License](#license)

---

# Self Hosted

## Installation

Choose a directory on your system that CineFlow will use as its mount point.

For the examples below we will refer to this path as:


/path/to/cineflow/mount


### 1. Configure Docker Compose

Copy the contents of `docker-compose.yml` into your local compose file.

Update the volume paths to match your environment.

Example:

```yaml
volumes:
  - /path/to/cineflow/data:/cineflow/data
  - /path/to/cineflow/mount:/mount:rshared,z

When mounting /mount inside containers, always include:

:rshared,z

to ensure proper mount propagation.

2. Create the Mount Directory

Run once per boot:

sudo mkdir -p /path/to/cineflow/mount
sudo mount --bind /path/to/cineflow/mount /path/to/cineflow/mount
sudo mount --make-rshared /path/to/cineflow/mount

Verify propagation:

findmnt -T /path/to/cineflow/mount -o TARGET,PROPAGATION

Expected output:

shared

or

rshared
Optional: Automatically configure on boot
Option A — systemd unit
[Unit]
Description=Make CineFlow data bind mount shared
After=local-fs.target
Before=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/mount --bind /path/to/cineflow/mount /path/to/cineflow/mount
ExecStart=/usr/bin/mount --make-rshared /path/to/cineflow/mount
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target

Enable it:

sudo systemctl enable --now cineflow-bind-shared.service
Option B — fstab entry
/path/to/cineflow/mount  /path/to/cineflow/mount  none  bind,rshared  0  0
Plex

Current Plex library requirements:

Type	Categories
Movies	movies, anime_movies
Shows	shows, anime_shows

These requirements may become configurable in future versions.

Troubleshooting
Plex shows empty /mount after CineFlow restart

If Plex temporarily loses visibility of the mount, it is usually caused by mount propagation or startup order.

Verify the following:

Host mount propagation
sudo mount --bind /path/to/cineflow/mount /path/to/cineflow/mount
sudo mount --make-rshared /path/to/cineflow/mount

Check propagation:

findmnt -T /path/to/cineflow/mount -o TARGET,PROPAGATION
Container mount propagation

Inside the Plex container:

docker exec -it plex sh -c 'findmnt -T /mount -o TARGET,PROPAGATION,OPTIONS,FSTYPE'

Expected propagation:

rslave

or

rshared
Docker compose configuration

Ensure Plex has:

- /path/to/cineflow/mount:/mount:rslave,z
Clearing stale FUSE mounts

If CineFlow crashes or stops unexpectedly:

sudo fusermount -uz /path/to/cineflow/mount || sudo umount -l /path/to/cineflow/mount

Then restart CineFlow.

CineFlow VFS and Caching

CineFlow includes a virtual filesystem (VFS) designed for efficient streaming, caching, and media organization.

Cache Settings
Setting	Description
cache_dir	Directory for cached data
cache_max_size_mb	Maximum cache size
chunk_size_mb	Size of CDN request chunks
fetch_ahead_chunks	Number of chunks prefetched
ttl_seconds	Optional expiration when using TTL eviction

Default behavior uses LRU eviction, automatically removing the least recently used cache blocks when space is needed.

Contributing

Community contributions are welcome.

Please see:

CONTRIBUTING.md for development setup and guidelines

GitHub Issues for bug reports and feature requests

Discord for discussions and support

Commits should follow the Conventional Commits specification.

License

CineFlow is licensed under the GNU GPLv3 License.

See the LICENSE
 file for details.


---

💡 If you want, I can also make a **much more modern README** (like Stremio/Stash/Radarr style) with:

- Feature section
- Architecture diagram
- Quick start
- Screenshots
- Clean badges
- Docker install in 10 seconds

That version would make the repo look **10× more professional**.
