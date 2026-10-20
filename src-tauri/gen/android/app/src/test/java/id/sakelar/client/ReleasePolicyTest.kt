package id.sakelar.client

import org.junit.Assert.*
import org.junit.Test

class ReleasePolicyTest {
  @Test fun autoInstallRequiresIdleBackgroundPermissionAndSupportedAndroid() {
    assertTrue(ReleasePolicy.canAutoInstall(36, true, false, false, false, true))
    assertFalse(ReleasePolicy.canAutoInstall(30, true, false, false, false, true))
    assertFalse(ReleasePolicy.canAutoInstall(36, false, false, false, false, true))
    assertFalse(ReleasePolicy.canAutoInstall(36, true, true, false, false, true))
    assertFalse(ReleasePolicy.canAutoInstall(36, true, false, true, false, true))
    assertFalse(ReleasePolicy.canAutoInstall(36, true, false, false, true, true))
    assertFalse(ReleasePolicy.canAutoInstall(36, true, false, false, false, false))
  }
  @Test fun stableVersionsCompareNumerically() {
    assertTrue(ReleasePolicy.newer("v0.1.10", "0.1.9"))
    assertTrue(ReleasePolicy.newer("v1.0.0", "0.99.99"))
    assertFalse(ReleasePolicy.newer("v0.1.9", "0.1.10"))
    assertFalse(ReleasePolicy.newer("v1.2.3", "1.2.3"))
  }
  @Test fun rejectsUnstableTagsAndForeignAssets() {
    val digest = "sha256:" + "a".repeat(64)
    val tag = "v1.2.0"; val url = "https://github.com/gabrieelibrahim/SuperGPT/releases/download/$tag/SuperGPT.apk"
    ReleasePolicy.validate(tag, url, digest, 30000000)
    for (bad in listOf(url.replace("https:", "http:"), url.replace("SuperGPT.apk", "SuperGPT-v1.2.apk"), url.replace("github.com", "github.com.evil.test"), url + "?token=secret", url.replace("gabrieelibrahim", "another-owner"))) {
      try { ReleasePolicy.validate(tag, bad, digest, 30000000); fail(bad) } catch (_: IllegalArgumentException) { }
    }
    for (bad in listOf("v1.2.0-beta", "1.2.0", "v../release", "v1.2")) {
      try { ReleasePolicy.validate(bad, url, digest, 30000000); fail(bad) } catch (_: IllegalArgumentException) { }
    }
  }
  @Test fun rejectsMissingChecksumAndOversizedOrEmptyApk() {
    val tag = "v1.2.0"; val url = "https://github.com/gabrieelibrahim/SuperGPT/releases/download/$tag/SuperGPT.apk"
    for (digest in listOf("", "sha1:" + "a".repeat(40), "sha256:bad")) {
      try { ReleasePolicy.validate(tag, url, digest, 100); fail(digest) } catch (_: IllegalArgumentException) { }
    }
    for (size in listOf(0L, 151 * 1024 * 1024L)) {
      try { ReleasePolicy.validate(tag, url, "sha256:" + "a".repeat(64), size); fail("size") } catch (_: IllegalArgumentException) { }
    }
  }
}
