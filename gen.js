import YAML from 'yaml';
import * as fsp from 'fs/promises';
import * as path from 'path';
import axios from 'axios';

console.log("Getting files and directories...");

const dirname = path.dirname(process.argv[1]);
const username = process.argv[2];
const token = process.argv[3];

async function fetch_addon_loader() {
    const { data } = await axios.get("https://api.github.com/repos/gw2-addon-loader/loader-core/releases/latest", { auth: { username: username, password: token } });
    const { data: data2 } = await axios.get("https://api.github.com/repos/gw2-addon-loader/d3d9_wrapper/releases/latest", { auth: { username: username, password: token } });
    return {
        name: "Addon Loader",
        developer: "megai2",
        website: "https://github.com/gw2-addon-loader/loader-core",
        loader_version_id: data.tag_name,
        loader_download_url: data.assets[0].browser_download_url,
        wrapper_version_id: data2.tag_name,
        wrapper_download_url: data2.assets[0].browser_download_url
    };
}

async function fetch_addon_manager() {
    const { data } = await axios.get("https://api.github.com/repos/gw2-addon-loader/GW2-Addon-Manager/releases/latest", { auth: { username: username, password: token } });
    return {
        name: "GW2 Unofficial Addon Manager",
        developer: "FriendlyFire",
        website: "https://github.com/gw2-addon-loader/GW2-Addon-Manager",
        version_id: data.tag_name,
        download_url: data.assets[0].browser_download_url
    };
}

let addons = {};

async function insert_github(addon) {
    const { data } = await axios.get(addon.host_url, { auth: { username: username, password: token } });
    addon.version_id = data.tag_name;
    addon.version_id_is_human_readable = true;
    addon.download_url = data.assets[0].browser_download_url;
}

async function insert_standalone(addon) {
    addon.version_id_is_human_readable = false;
    if (addon.version_url != null) {
        const { data } = await axios.get(addon.version_url, { responseType: 'text', transitional: { forcedJSONParsing: false } });
        addon.version_id = data;
    }
    addon.download_url = addon.host_url;
}

async function add_addon(name, file) {
    console.log("Loading " + name + " from YAML...");

    try {
        let yaml = YAML.parse(file);
        yaml.nickname = name;

        try {
            if (yaml.host_type === 'github')
                await insert_github(yaml);
            else if (yaml.host_type === 'standalone')
                await insert_standalone(yaml);
        } catch (ex) {
            console.log("Error: Could not successfully fetch version information for addon '" + name + "': " + ex);
        }
        addons[name] = yaml;

    } catch (ex) {
        console.log("Error: Could not successfully parse YAML for addon '" + name + "': " + ex);
    }
}

const files = await fsp.readdir(dirname, { withFileTypes: true });
for (const file of files) {
    if (!file.isDirectory() || file.name[0] == '.' || file.name == "node_modules")
        continue;

    try {
        const update_file = await fsp.readFile(dirname + "/" + file.name + "/update.yaml", "utf-8");
         await add_addon(file.name, update_file);
        continue;
    } catch (ex) {
        if(ex.code !== 'ENOENT')
            console.log("Info: Encountered exception " + ex);
    }

    console.log("Notice: Addon " + file.name + " does not contain an 'update.yaml' file.");

    try {
        const update_file = await fsp.readFile(dirname + "/" + file.name + "/update-placeholder.yaml", "utf-8");
        await add_addon(file.name, update_file);
        continue;
    } catch (ex) {
        if(ex.code !== 'ENOENT')
            console.log("Info: Encountered exception " + ex);
    }

    console.log("Warning: Folder " + file.name + " does not appear to be a valid addon description.");
}

console.log("Found " + Object.keys(addons).length + " addons.");

const addon_loader = await fetch_addon_loader();
const addon_manager = await fetch_addon_manager();

try {
    await fsp.mkdir(dirname + "/.build");
} catch { }

await fsp.writeFile(dirname + "/.build/addons.json", JSON.stringify({
    "addons": addons,
    "loader": addon_loader,
    "manager": addon_manager
}), "utf-8");
await fsp.copyFile(dirname + "/index.html", dirname + "/.build/index.html");