# Airplane-mode checklist (Person 4)

Run this on a **fresh laptop** with the internet physically off. Tick every line.

## Automated
- [ ] `pytest` passes (includes the `no_network` happy path)
- [ ] `python scripts/check_assets.py` shows 0 failures; read every `[WARN]`

## Start the box
- [ ] Laptop Wi-Fi is OFF (airplane icon visible), or the ethernet cable is out
- [ ] Turn on the laptop's own hotspot (see below), then `./scripts/run_offline.sh`
- [ ] Terminal prints the URL and QR; `GET /api/health` shows `{"mode":"offline","providers":["rules"],"db":"sqlite"}`
- [ ] UI badge reads "Offline · Rules"

## Zero external requests
- [ ] Browser dev tools > Network tab, reload: no request leaves localhost / the LAN IP
- [ ] No failed requests for fonts, icons, Leaflet, tiles (a single CDN link breaks offline)
- [ ] Map shows the GeoJSON basemap, not a blank background

## Phone on the hotspot
- [ ] Real phone joins the laptop's hotspot and **stays connected** (Android may jump to mobile data when a Wi-Fi has no internet: turn mobile data off on the demo phones)
- [ ] Phone opens the URL from the QR (never `reliefos.local`)
- [ ] Phone submits "pani 600 log camp 17" -> record appears in the review queue
- [ ] Double send of the same report -> exactly one record
- [ ] Approve -> marker on the laptop map; matcher proposes a move; distance is labelled straight-line

## Never-cached inputs
- [ ] Two fresh messages (not in `extraction_cache`) handled by the rules parser or land in review as low confidence

## Hotspot setup cheatsheet
- **Windows:** Settings > Network > Mobile hotspot. Laptop address is usually `192.168.137.1`
- **macOS:** System Settings > General > Sharing > Internet Sharing (share from Ethernet/Thunderbolt to Wi-Fi). Address is usually `192.168.2.1`
- **Linux:** `nmcli device wifi hotspot ssid ReliefOS password reliefos123`. Address is usually `10.42.0.1`
- A small travel router with no uplink also works; use the laptop's address on that router
- If the QR shows the wrong address: `RELIEFOS_HOST_IP=<address> ./scripts/run_offline.sh`

## If something breaks
- Phone cannot open the page: same Wi-Fi? Address typed with `http://` and `:5000`? Laptop firewall allowing the port?
- Map blank: `python scripts/make_basemap_placeholder.py`, rebuild frontend, reload
- Power: keep the laptop on charge or a power bank; a power cut ends the box
