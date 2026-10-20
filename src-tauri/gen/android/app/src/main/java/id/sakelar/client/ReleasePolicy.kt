package id.sakelar.client

object ReleasePolicy {
  fun canAutoInstall(sdk: Int, enabled: Boolean, blocked: Boolean, busy: Boolean, foreground: Boolean, permission: Boolean) = sdk >= 31 && enabled && !blocked && !busy && !foreground && permission
  fun parts(version: String): List<Long> {
    require(version.matches(Regex("v?[0-9]+\\.[0-9]+\\.[0-9]+"))) { "Versi harus berbentuk v1.2.0." }
    return version.removePrefix("v").split('.').map { it.toLong() }
  }
  fun newer(remote: String, installed: String): Boolean {
    val a = parts(remote); val b = parts(installed)
    for (i in 0..2) if (a[i] != b[i]) return a[i] > b[i]
    return false
  }
  fun validate(tag: String, url: String, digest: String, size: Long) {
    require(tag.startsWith("v")); parts(tag)
    require(url == "https://github.com/gabrieelibrahim/SuperGPT/releases/download/$tag/SuperGPT.apk") { "Alamat APK tidak valid." }
    require(digest.matches(Regex("sha256:[a-fA-F0-9]{64}"))) { "Rilis belum menyediakan checksum SHA-256." }
    require(size in 1..150 * 1024 * 1024L) { "Ukuran APK tidak valid." }
  }
}
