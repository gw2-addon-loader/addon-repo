import YAML from 'yaml';
import * as fsp from 'fs/promises';
import * as path from 'path';
import axios from 'axios';

console.log("Getting files and directories...");

const dirname = path.dirname(process.argv[1]);
const username = process.argv[2];
const token = process.argv[3];

let addons = {};

async function insert_github(addon) {
    const { data } = await axios.get(addon.host_url, { auth: { username: username, password: token } });
    addon.version_id = data.tag_name;
    addon.download_url = data.assets[0].browser_download_url;
}

async function insert_standalone(addon) {
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

try {
    await fsp.mkdir(dirname + "/.build");
} catch { }

await fsp.writeFile(dirname + "/.build/addons.json", JSON.stringify(addons), "utf-8");
await fsp.copyFile(dirname + "/index.html", dirname + "/.build/index.html");