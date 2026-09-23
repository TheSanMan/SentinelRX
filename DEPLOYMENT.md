# Hosting and iPhone installation

The app is prepared for a free private pilot on an [Oracle Cloud Always Free VM](https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm). It needs a server because search, label OCR, and DrugBank answers run in Python against a large SQLite database. A static host alone cannot run those features. Always Free capacity and account eligibility depend on Oracle's current availability and terms.

The existing database is excluded from Git and the Docker image. Transfer it privately to the VM rather than rebuilding it.

## VM deployment

1. Create an [Oracle Cloud Free Tier account](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm) and sign in to the Console. Choose the home region carefully: Always Free compute is provisioned there, and the home region cannot be changed later. Account registration and any personal verification are the owner's steps; the remaining setup can be done by the deployment operator from the signed-in Console.
2. Create an Always Free Ubuntu VM, preferably an Ampere A1 shape within the free allowance, with enough boot storage for the 567 MB database, image, and logs. Give it a public IP and add an SSH public key. Install Docker Engine and the Compose plugin using Docker's current Ubuntu instructions.
3. Allow inbound TCP 80 and 443 in both the Oracle network security rules and the VM firewall. A no-registration hostname can be formed as `sentinelrx.VM_PUBLIC_IP.sslip.io` by replacing `VM_PUBLIC_IP` with the VM's IPv4 address (for example, `sentinelrx.203.0.113.10.sslip.io`). [sslip.io](https://sslip.io/) resolves such names to the embedded IP. A domain you control can replace this later; if the VM's IP changes, the sslip.io URL changes too.
4. Clone the repository onto the VM. Transfer the existing `drugbank.db` privately to `data/drugbank.db`. Keep it out of source control. The file must be readable by container UID 10001.
5. Copy `deploy/Caddyfile.example` to `deploy/Caddyfile` and replace `VM_PUBLIC_IP` with the actual IP. Generate a password hash with `docker run -it --rm caddy:2 caddy hash-password` and replace `REPLACE_WITH_CADDY_PASSWORD_HASH` with the output. Share the username `friend` and your chosen password only with intended users. The live Caddyfile is ignored by Git.
6. Run `docker compose up --build -d`. Check `https://sentinelrx.VM_PUBLIC_IP.sslip.io/api/health` after signing in; it should report `{"status":"ok"}`. Caddy obtains and renews a public HTTPS certificate once DNS and ports are correct. Test search, an interaction check, a label photo, and an assistant answer on the public address before inviting anyone.

The included Compose configuration exposes only Caddy to the internet. The database stays a read-only local mount. The password gate limits access to friends, but each device still stores its own medication list in browser local storage. Clearing Safari website data removes that list. No cross-device sync or accounts are included.

## iPhone installation

Open the HTTPS site in Safari, use **Share → Add to Home Screen → Add**, and launch the new icon. The app has a Home Screen icon, standalone display metadata, and an offline shell; search, OCR, and answers still require network access. Apple's [web app guidance](https://developer.apple.com/videos/play/wwdc2023/10120/) covers this installation path. It requires no App Store listing or Apple Developer membership.

A signed native iPhone build for friends through TestFlight is a separate step. Apple's [Developer Program](https://developer.apple.com/programs/whats-included/) is currently $99/year, and [TestFlight](https://developer.apple.com/testflight/) distribution needs that membership and Apple's review process. The web app is the usable free distribution path for this version.
