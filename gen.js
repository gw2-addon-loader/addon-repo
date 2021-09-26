import YAML from 'yaml';
import * as fsp from 'fs/promises';
import * as path from 'path';

console.log("Getting files and directories...");

const dirname = path.dirname(process.argv[1]);

let addons = {};

function add_addon(name, file) {
    console.log("Loading " + name + " from YAML...");
    const yaml = YAML.parse(file);
    addons[name] = yaml;
}

const files = await fsp.readdir(dirname, { withFileTypes: true });
for (const file of files) {
    if (!file.isDirectory() || file.name[0] == '.' || file.name == "node_modules")
        continue;

    try {
        const update_file = await fsp.readFile(dirname + "/" + file.name + "/update.yaml", "utf-8");
        add_addon(file.name, update_file);
        continue;
    } catch (ex) {
        if(ex.code !== 'ENOENT')
            console.log("Info: Encountered exception " + ex);
    }

    console.log("Notice: Addon " + file.name + " does not contain an 'update.yaml' file.");

    try {
        const update_file = await fsp.readFile(dirname + "/" + file.name + "/update-placeholder.yaml", "utf-8");
        add_addon(file.name, update_file);
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