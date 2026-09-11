type DarkMode = "none" | "invert" | "outline";

export interface OSInfo {
  id: string;
  name: string;
  image: string;
  darkMode: DarkMode;
  supported: boolean;
}

interface OSDefinition {
  id: string;
  name: string;
  icon: string;
  aliases: readonly string[];
  darkMode: DarkMode;
}

const iconModules = import.meta.glob<string>(
  "../assets/os/*.{svg,png,webp,ico}",
  { eager: true, query: "?url", import: "default" },
);

const GENERIC_ICON = "os-generic.svg";
const LINUX_ICON = "linux.svg";

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function defineOS(
  id: string,
  name: string,
  icon: string,
  aliases: readonly string[],
  darkMode?: DarkMode,
): OSDefinition {
  return {
    id,
    name,
    icon,
    aliases: aliases.map(normalize),
    darkMode: darkMode ?? (icon === LINUX_ICON ? "outline" : "none"),
  };
}

const OS_DEFINITIONS: readonly OSDefinition[] = [
  defineOS("android", "Android", "os-android.svg", ["android"]),
  defineOS("proxmox", "Proxmox VE", "os-proxmox.png", ["proxmox ve", "proxmox"]),
  defineOS("synology", "Synology DSM", "os-synology.png", ["synology dsm", "synology"]),
  defineOS("fnos", "fnOS", "os-fnos.ico", ["fnos"]),
  defineOS("routeros", "RouterOS", GENERIC_ICON, ["mikrotik routeros", "routeros"]),
  defineOS("istoreos", "iStoreOS", "os-istore.png", ["istoreos", "istore os"]),
  defineOS("immortalwrt", "ImmortalWrt", "os-openwrt.svg", ["immortalwrt", "immortal wrt"]),
  defineOS("openwrt", "OpenWrt", "os-openwrt.svg", ["openwrt", "open wrt"]),
  defineOS("opencloudos", "OpenCloudOS", "os-opencloudos.png", ["opencloudos", "opencloud os"]),
  defineOS("tencentos", "TencentOS Server", LINUX_ICON, ["tencentos server", "tencentos"]),
  defineOS("unraid", "Unraid", "os-unraid.svg", ["unraid"]),
  defineOS("qts", "QTS", "os-qnap.svg", ["quts hero", "qutscloud", "qnap qts", "qts", "qes"]),
  defineOS("truenas", "TrueNAS", GENERIC_ICON, ["truenas scale", "truenas core", "truenas"]),
  defineOS("almalinux", "AlmaLinux", "os-alma.svg", ["almalinux", "alma linux"]),
  defineOS("alpine", "Alpine Linux", "os-alpine.webp", ["alpine linux", "alpine"]),
  defineOS("aosc", "AOSC OS", "os-aosc.svg", ["aosc os", "aosc"]),
  defineOS("armbian", "Armbian", "os-armbian.svg", ["armbian"], "outline"),
  defineOS("centos", "CentOS", "os-centos.svg", ["centos stream", "centos"]),
  defineOS("raspberrypi", "Raspberry Pi OS", LINUX_ICON, ["raspberry pi os", "raspbian"]),
  defineOS("devuan", "Devuan", LINUX_ICON, ["devuan"]),
  defineOS("debian", "Debian", "os-debian.svg", ["debian"]),
  defineOS("freebsd", "FreeBSD", "os-freebsd.svg", ["freebsd"]),
  defineOS("openbsd", "OpenBSD", GENERIC_ICON, ["openbsd"]),
  defineOS("netbsd", "NetBSD", GENERIC_ICON, ["netbsd"]),
  defineOS("ubuntu", "Ubuntu", "os-ubuntu.svg", [
    "ubuntu mate",
    "ubuntu",
    "kubuntu",
    "xubuntu",
    "lubuntu",
  ]),
  defineOS("windows", "Windows", "os-windows.svg", [
    "microsoft windows",
    "windows",
    "win32",
    "win64",
  ]),
  defineOS("arch", "Arch Linux", "os-arch.svg", ["arch linux", "arch"]),
  defineOS("artix", "Artix Linux", LINUX_ICON, ["artix linux", "artix"]),
  defineOS("kali", "Kali Linux", "os-kali.svg", ["kali linux", "kali"], "invert"),
  defineOS("nixos", "NixOS", "os-nix.svg", ["nixos", "nix os"]),
  defineOS("rocky", "Rocky Linux", "os-rocky.svg", ["rocky linux", "rocky"]),
  defineOS("fedora", "Fedora", "os-fedora.svg", ["fedora coreos", "fedora linux", "fedora"]),
  defineOS("opensuse", "openSUSE", "os-opensuse.svg", ["opensuse tumbleweed", "opensuse leap", "opensuse"]),
  defineOS("sles", "SUSE Linux Enterprise", LINUX_ICON, ["suse linux enterprise server", "sles"]),
  defineOS("gentoo", "Gentoo", "os-gentoo.svg", ["gentoo linux", "gentoo"]),
  defineOS("redhat", "Red Hat Enterprise Linux", "os-redhat.svg", [
    "red hat enterprise linux",
    "redhat enterprise linux",
    "red hat",
    "rhel",
  ]),
  defineOS("oracle", "Oracle Linux", LINUX_ICON, ["oracle linux server", "oracle linux"]),
  defineOS("amazon", "Amazon Linux", LINUX_ICON, ["amazon linux"]),
  defineOS("cloudlinux", "CloudLinux", LINUX_ICON, ["cloudlinux"]),
  defineOS("azurelinux", "Azure Linux", LINUX_ICON, ["azure linux", "cbl mariner", "mariner"]),
  defineOS("mint", "Linux Mint", "os-mint.svg", ["linux mint", "mint linux"]),
  defineOS("manjaro", "Manjaro", "os-manjaro.svg", ["manjaro linux", "manjaro"]),
  defineOS("popos", "Pop!_OS", LINUX_ICON, ["pop os"]),
  defineOS("elementary", "elementary OS", LINUX_ICON, ["elementary os"]),
  defineOS("deepin", "Deepin", LINUX_ICON, ["deepin"]),
  defineOS("uos", "UnionTech OS", LINUX_ICON, ["uniontech os", "uos server", "uos"]),
  defineOS("void", "Void Linux", LINUX_ICON, ["void linux", "void"]),
  defineOS("slackware", "Slackware", LINUX_ICON, ["slackware"]),
  defineOS("solus", "Solus", LINUX_ICON, ["solus"]),
  defineOS("clearlinux", "Clear Linux", LINUX_ICON, ["clear linux os", "clear linux"]),
  defineOS("flatcar", "Flatcar Container Linux", LINUX_ICON, ["flatcar container linux", "flatcar"]),
  defineOS("coreos", "CoreOS", LINUX_ICON, ["coreos"]),
  defineOS("photon", "VMware Photon OS", LINUX_ICON, ["vmware photon os", "photon os"]),
  defineOS("macos", "macOS", "os-macos.svg", ["mac os x", "mac os", "macos", "darwin"], "invert"),
  defineOS("astra", "Astra Linux", "os-astra.png", ["astra linux", "astra"]),
  defineOS("orangepi", "Orange Pi OS", "os-orange-pi.svg", ["orange pi os", "orangepi os", "orange pi"]),
  defineOS("hce", "Huawei Cloud EulerOS", "os-huawei.svg", ["huawei cloud euleros", "hce os"], "outline"),
  defineOS("openeuler", "openEuler", LINUX_ICON, ["openeuler", "open euler"]),
  defineOS("euleros", "EulerOS", "os-huawei.svg", ["euleros", "euler os"], "outline"),
  defineOS("huawei", "Huawei", "os-huawei.svg", ["huawei"], "outline"),
  defineOS("alibabacloud", "Alibaba Cloud Linux", "alibabacloud-color.svg", [
    "alibaba cloud linux",
    "aliyun linux",
    "alinux",
  ]),
  defineOS("anolis", "Anolis OS", LINUX_ICON, ["anolis os", "anolis"]),
  defineOS("linux", "Linux", LINUX_ICON, ["gnu linux", "linux"]),
];

function iconURL(filename: string): string {
  return iconModules[`../assets/os/${filename}`] ?? iconModules[`../assets/os/${GENERIC_ICON}`];
}

export const DEFAULT_OS_IMAGE = iconURL(GENERIC_ICON);

const UNKNOWN_OS: OSInfo = {
  id: "unknown",
  name: "Unknown",
  image: DEFAULT_OS_IMAGE,
  darkMode: "none",
  supported: false,
};

const cache = new Map<string, OSInfo>();

function matches(normalized: string, aliases: readonly string[]): boolean {
  const input = ` ${normalized} `;
  return aliases.some((alias) => input.includes(` ${alias} `));
}

export function getOSInfo(osString: string): OSInfo {
  const source = typeof osString === "string" ? osString.trim() : "";
  if (!source) return UNKNOWN_OS;

  const cached = cache.get(source);
  if (cached) return cached;

  const normalized = normalize(source);
  const definition = OS_DEFINITIONS.find((item) => matches(normalized, item.aliases));
  const info: OSInfo = definition
    ? {
        id: definition.id,
        name: definition.name,
        image: iconURL(definition.icon),
        darkMode: definition.darkMode,
        supported: true,
      }
    : {
        ...UNKNOWN_OS,
        name: source,
      };

  cache.set(source, info);
  return info;
}

export function getOSImage(osString: string): string {
  return getOSInfo(osString).image;
}

export function getOSName(osString: string): string {
  return getOSInfo(osString).name;
}

export function getAllOSImages(): Record<string, string> {
  return Object.fromEntries(OS_DEFINITIONS.map((item) => [item.id, iconURL(item.icon)]));
}

export function isSupportedOS(osString: string): boolean {
  return getOSInfo(osString).supported;
}

export function setOSImageFallback(image: HTMLImageElement): void {
  if (image.dataset.osFallback === "true") return;
  image.dataset.osFallback = "true";
  image.dataset.osIcon = "unknown";
  image.dataset.darkMode = "none";
  image.src = DEFAULT_OS_IMAGE;
}
