//import { createRequire } from "module";
//const require = createRequire(import.meta.url)
var config = require('./configuration.json');
const fs = require('fs')
const cipclient = require('./crestroncip.js');
const OBSWebSocket = require('obs-websocket-js').OBSWebSocket;

const obs = new OBSWebSocket();

var Cache = {} 

// Auto configuration updater
var ConfigCooldown = false
fs.watch("configuration.json", (eventType, filename) => {
    if (eventType === "change") {
        if (ConfigCooldown === true) return
        (async function () {
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
            ConfigCooldown = true
            await sleep(300)
            if (config.Debug) { console.log("Updating config from configuration.json") } // Debug output
            delete require.cache[require.resolve('./configuration.json')]
            config = require('./configuration.json');
            Cache = {}
            await sleep(1000)
            ConfigCooldown = false
        })()
    }
});

const TypeTable = { // Quick and easy way to translate from config to Crestron CPI, & Vice Versa
    "A": "analog",
    "D": "digital",
    "S": "serial",
    "analog": "A",
    "digital": "D",
    "serial": "S"
}


var RecievedCache = {
    Digital: {},
    Analog: {},
    Serial: {}
}




async function FindProperty(JoinType, ID) { // Finds a specific property and device from the specified join
    // if (Cache[JoinType + String(ID)]) return Cache[JoinType + String(ID)]
    if (!TypeTable[JoinType]) return "Invalid Join Type"
    var Match = TypeTable[JoinType] + String(ID)
    if (config.Joins[Match]) return config.Joins[Match]
    return "No matching property found"
}


// Connect to Crestron
const cip = cipclient.connect({ host: config.CrestronConfig.Host, ipid: String.fromCharCode(config.CrestronConfig.IPID) }, () => {
    console.log(`Crestron | Connected to ${config.CrestronConfig.Host} with IP ID ${config.CrestronConfig.IPID}`)
})




function UpdateFromCrestron(data) {
    if (data.type === "digital") {
        //if (RecievedCache.Digital[data.join] === data.value) return
        RecievedCache.Digital[data.join] = data.value
        //SetDigital(data.join, data.value)
    }
    if (data.type === "analog") {
        if (RecievedCache.Analog[data.join] === data.value) return
        RecievedCache.Analog[data.join] = data.value
    }
    if (data.type === "serial") {
        //if (RecievedCache.Serial[data.join] === data.value) return
        RecievedCache.Serial[data.join] = data.value
    }
    FindProperty(data.type, data.join).then(async (Response) => {
        console.log(1)
        if (typeof Response === "string") return;
        console.log(2)
        if (!Response) return;
        console.log(3)
        console.log(data.value)
        if (data.value === 1) {
            console.log(4)
            obs.call(Response.RequestType, Response.RequestData);
        }

    })


}


async function Start() {
    try {
        const {
            obsWebSocketVersion,
            negotiatedRpcVersion
        } = await obs.connect(config.OBSConfig.Url, config.OBSConfig.Password, {
            rpcVersion: 1
        });
        console.log(`Connected to server ${obsWebSocketVersion} (using RPC ${negotiatedRpcVersion})`)
        cip.subscribe((data) => { // Incoming data from Crestron
            if (config.Debug) { console.log("Recieved " + data.type + " join with ID: " + data.join + " and a value: of " + data.value) } // Debug output
            UpdateFromCrestron(data)
        })
    
    } catch (error) {
        console.error('Failed to connect', error.code, error.message);
    }
    
}


Start()