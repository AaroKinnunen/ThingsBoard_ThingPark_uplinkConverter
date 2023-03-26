var constants = {
    'commonMessageHeaderSpr': 
    {
        'type':                         //Application headers for different packets
        {
            01: "Application 3P",
            02: "Application 1P",
            03: "Application VMUMC-OC",
            255: "Application Error"
        },
        
    },
    'Error_message': {
        1: "Autoscan in progress",
        2: "No meter connected",
        3: "Invalid meter",
        4: "Invalid meter setup"
    },
};

/**
 * Start decoder
 * @type {any | undefined}
 */
var payLoadJson = decodeToJson(payload); //turns payload to JSON form if not already
var result = setPayload(); // variable the decoder function returns
var payload_hex;
var payloadByte = [];
var telemetryC;
var devEuiLink;


/** Helper functions **/
/**
 * Parsing metadata and payload_hex
 * @param payLoadJson
 * @returns {null|{payload: {deviceType: string, telemetry: string, deviceName: string}}}
 */
function setPayload() {
    if (payLoadJson !== null) {
        if (payLoadJson !== null && payLoadJson.length !== 0) {
            if (payLoadJson.hasOwnProperty('DevEUI_uplink')) {
                devEuiLink = payLoadJson.DevEUI_uplink;
            } else if (payLoadJson.hasOwnProperty('DevEUI_downlink_Sent')) {
                devEuiLink = payLoadJson.DevEUI_downlink_Sent;
            }
            if (devEuiLink !== null && devEuiLink.length !== 0) {
                var payloadResult = getPayload();
                if (devEuiLink.hasOwnProperty('payload_hex')) {
                    payload_hex = devEuiLink['payload_hex'];
                    if (payload_hex !== null && payload_hex.length !== 0) {
                        payload_hex = payload_hex.trim();
                        payloadByte = hexStringToBytes(payload_hex);            // Convert the hex values to bytes
                        payloadResult.telemetry = (payLoadJson.hasOwnProperty('DevEUI_uplink')) ? getTelemetryUp() : getTelemetryDown();
                    }
                }
                else{
                    //payloadResult.telemetry =getTelemetryDown();       // if downlinks would be used
                }
                payloadResult.deviceName = devEuiLink['DevEUI'];
                return payloadResult;
            }
        }
    }
    return null;
}

/**
 * Receiving telemetry by value message_type
 * @param payload_hex
 * @param payLoadJson
 * @returns {null|Telemetry }
 */
function getTelemetryUp() {
    var message_type = payloadByte[0];          //Checking the application header
    switch (message_type) {
        case 01:                                // "Application 3P"
            return getTelemetryCarlo_3P();
        case 02:                                //"Application 1P"
            return getpackets();
        case 03:                                // "Application VMUMC-OC"
            return null;
        case 255:                               // Application Error
            return getErrorMessage();
        default: 
            return null;
    }
}
function getpackets(){
    switch(payloadByte[1]){
        case 97:                                // if UWPA packet 2 is sent
            return getTelemetryCarlo_1P61();
        case 99:                                //if UWPA packet 1 is sent
            return getTelemetryCarlo_1P63();
        default:
        return null;
    }
}

function getTelemetryDown() {
    telemetryC = getTelemetryCommonDown();
    return telemetryC;
}

function getTelemetryCarlo_1P63(){
    var tele =get_1P_Telemetry(); // Load the telemetry model
    var mes =hexStringToBytes(payload_hex); // Convert the hex message to bytes
    
    if(mes[1]==99){ // Check the first byte after the application header byte 
            var x = mes.slice(2,6); // Check the length of the variable from UWPA datasheet,
                                    //but remove the headerbyte --> kw L1 = 4 bytes
             for (var j = 0; j < x.length; j++) {
                      tele['kW L1']+=x[j]<<(8*(j)); // Bitwise shift operation
                } 
               tele['kW L1']=tele['kW L1']*0.000001; // The UWP multiplier 0.000001
            mes.splice(1,5); //Remove the variable bytes from the original message
        
    }
     if(mes[1]==100){
            var x1 = mes.slice(2,6); // kVa = 4 bytes
             for (var j = 0; j < x1.length; j++) {
                      tele['kVA L1']+=x1[j]<<(8*(j));
                } 
                tele['kVA L1']=tele['kVA L1']*0.000001; // The UWP multiplier 0.000001
            mes.splice(1,5); //Remove the variable bytes from the original message
        
    }
     if(mes[1]==101){
            var x2 = mes.slice(2,6); // kvar = 4 bytes
             for (var j = 0; j < x2.length; j++) {
                      tele['kvar L1']+=x2[j]<<(8*(j));
                } 
                tele['kvar L1']=tele['kvar L1']*0.000001; // The UWP multiplier 0.000001
            mes.splice(1,5); //Remove the variable bytes from the original message
        
    }
     if(mes[1]==60){
            var x2 = mes.slice(2,10); // kWh = 8 bytes
             for (var j = 0; j < x2.length; j++) {
                      tele['kWh (+) TOT']+=x2[j]<<(8*(j));
                } 
                tele['kWh (+) TOT']=tele['kWh (+) TOT']*0.1; // The UWP multiplier 0.1
            mes.splice(1,9); //Remove the variable bytes from the original message
    }
     if(mes[1]==62){
            var x2 = mes.slice(2,10); // kvarh = 8 bytes
             for (var j = 0; j < x2.length; j++) {
                      tele['kvarh (+) TOT']+=x2[j]<<(8*(j));
                } 
                tele['kvarh (+) TOT']=tele['kvarh (+) TOT']*0.1; // The UWP multiplier 0.1
            mes.splice(1,9); //Remove the variable bytes from the original message
    }
     if(mes[1]==255){
            var x = mes.slice(2,8); // Timestamp = 6 bytes
            var d = new Date(...x); // returns 2023 as 0123
            tele['TimestampEM24(UTC)']=d;
    }
    
    clean(tele);//Unused telemetry headers are not returned
    return tele;
}
function getTelemetryCarlo_1P61(){
    var tele =get_1P_Telemetry();
    var mes =hexStringToBytes(payload_hex);
    if(mes[1]==97){
            var x = mes.slice(2,6);
             for (var j = 0; j < x.length; j++) {
                      tele['V L1-N']+=x[j]<<(8*(j));
                }
                tele['V L1-N']=tele['V L1-N']*0.1; // The UWP multiplier 0.1
            mes.splice(1,5); //Remove
        
    }
     if(mes[1]==98){
            var x1 = mes.slice(2,6);
             for (var j = 0; j < x1.length; j++) {
                      tele['A L1']+=x1[j]<<(8*(j));
                } 
                tele['A L1']=tele['A L1']*0.001;    // The UWP multiplier 0.001
            mes.splice(1,5);    //Remove
    }
     if(mes[1]==102){
            var x2 = mes.slice(2,4);
             for (var j = 0; j < x2.length; j++) {
                      tele['PF L1']+=x2[j]<<(8*(j));
                } 
                tele['PF L1']=tele['PF L1']*0.01;   // The UWP multiplier 0.01
            mes.splice(1,3);    //Remove
        
    }
     if(mes[1]==103){
            var x2 = mes.slice(2,4);
             for (var j = 0; j < x2.length; j++) {
                      tele['Hz']+=x2[j]<<(8*(j));
                } 
                tele['Hz']=tele['Hz']*0.1;          // The UWP multiplier 0.1
            mes.splice(1,3);    //Remove
    }
     if(mes[1]==255){
            var x = mes.slice(2,8);
            var d = new Date(...x);
            tele['TimestampEM24(UTC)']=d;
    }
    
            
    
    clean(tele); //Unused telemetry headers are not returned
    return tele;
}


function clean(obj) {
    for (var propName in obj) {
        if (obj[propName] === null || obj[propName] === undefined ||obj[propName].length === 0) {
            delete obj[propName];
            }
        
    }
    return obj
    
}

function getTelemetryCarlo_3P(){
    var telemetry3p=get_3P_telemetry();
    var mes =payload_hex.slice(2,payload_hex.length);
    var splitted = mes.match(/.{1,18}/g);
   for (var i = 0; i < splitted.length; i++) {
       var x = hexStringToBytes(splitted[i]);
       switch (x[0]){
            case 60:
                var kwhBytes=x.slice(1,10);
                
                for (var j = 0; j < kwhBytes.length; j++) {
                    telemetry3p['kWh (+) TOT (3P)']+=kwhBytes[j]<<(8*(j));
                } 
                break;
             case 63:
                 var m =x.slice(1,10);
                  for (var j = 0; j < m.length; j++) {
                      telemetry3p['kWh (-) TOT (3P)']+=m[j]<<(8*(j));
                } 
                 
                break;
            case 66:
                var b =x.slice(1,10);
                 for (var j = 0; j < b.length; j++) {
                     telemetry3p['kWh (+) PAR (3P)'] +=b[j]<<(8*(j));
                } 
                break;
            case 69:
                var m1 =x.slice(1,10);
                 for (var j = 0; j < m1.length; j++) {
                     telemetry3p['kWh (-) PAR (3P)']+=m1[j]<<(8*(j));
                } 
                break;
            case 255:
                var timestampBytes=x.slice(1,8);
                //timestampBytes[0]=123;
                var d = new Date(...timestampBytes);
                //telemetry3p["TimestampEM24(UTC) (3P)"]=d;
                break;
            default:
                break;
            
        }
    }
    clean(telemetry3p);
    return telemetry3p;
}

function get_1P_Telemetry(){
    return {
        'kWh (+) TOT' :null,
        'kVAh (+) TOT' :null,
        'kvarh (+) TOT' : null,
        
        'kWh (-) TOT' :null,
        'kVAh (-) TOT' : null,
        'kvarh (-) TOT' : null,
         
        'kWh (+) PAR' :null,
        'kVAh (+) PAR' : null,
        'kvarh (+) PAR' : null,
        
        'kWh (-) PAR' :null,
        'kVAh (-) PAR' : null,
        'kvarh (-) PAR' : null,
        
        'kWh (+) t1' :null,
        'kWh (+) t2' :null,
        'kWh (+) t3' :null,
        'kWh (+) t4' :null,
        'kWh (+) t5' :null,
        'kWh (+) t6' :null,
        
        'kWh (-) t1' :null,
        'kWh (-) t2' :null,
        'kWh (-) t3' :null,
        'kWh (-) t4' :null,
        'kWh (-) t5' :null,
        'kWh (-) t6' :null,
        
        'kvarh (+) t1' :null,
        'kvarh (+) t2' :null,
        'kvarh (+) t3' :null,
        'kvarh (+) t4' :null,
        'kvarh (+) t5' :null,
        'kvarh (+) t6' :null,
        
        'kvarh (-) t1' :null,
        'kvarh (-) t2' :null,
        'kvarh (-) t3' :null,
        'kvarh (-) t4' :null,
        'kvarh (-) t5' :null,
        'kvarh (-) t6' :null,
        
        'V L1-N':null,
        'A L1': null,
        'kW L1':null,
        'kVA L1': null,
        'kvar L1':null,
        'PF L1': null,
        'Hz':null,
        'THD V L1-N':null,
        'THD A L1':null,
        
        'kWh (+) L1 TOT' :null,
        'kVAh (+) L1 TOT' : null,
        'kvarh (+) L1 TOT' : null,
        
        'kWh (-) L1 TOT' :null,
        'kVAh (-) L1 TOT' : null,
        'kvarh (-) L1 TOT' : null,
         
        'kWh (+) L1 PAR' :null,
        'kVAh (+) L1 PAR' : null,
        'kvarh (+) L1 PAR' : null,
        
        'kWh (-) L1 PAR' :null,
        'kVAh (-) L1 PAR' : null,
        'kvarh (-) L1 PAR' : null,
        'TimestampEM24(UTC)': null,

    };
}
function get_3P_telemetry(){
    return {
        'kWh (+) TOT (3P)':null,
        'kWh (-) TOT (3P)':null,
        'kWh (+) PAR (3P)':null,
        'kWh (-) PAR (3P)':null,
        'kWh (+) t1 (3P)':null,
        'kWh (+) t2 (3P)':null,
        'kWh (+) t3 (3P)':null,
        'kWh (+) t4 (3P)':null,
        'kWh (+) t5 (3P)':null,
        'kWh (+) t6 (3P)':null,
        'kWh (-) t1 (3P)':null,
        'kWh (-) t2 (3P)':null,
        'kWh (-) t3 (3P)':null,
        'kWh (-) t4 (3P)':null,
        'kWh (-) t5 (3P)':null,
        'kWh (-) t6 (3P)':null,
        'kWh (+) L1 TOT (3P)':null,
        'kWh (-) L1 TOT (3P)':null,
        'kWh (+) L1 PAR (3P)':null,
        'kWh (-) L1 PAR (3P)':null,
        'kWh (+) L2 TOT (3P)':null,
        'kWh (-) L2 TOT (3P)':null,
        'kWh (+) L2 PAR (3P)':null,
        'kWh (-) L2PAR (3P)':null,
        'kWh (+) L3 TOT (3P)':null,
        'kWh (-) L3 TOT (3P)':null,
        'kWh (+) L3 PAR (3P)':null,
        'kWh (-) L3 PAR (3P)':null,
        'TimestampEM24(UTC) (3P)':0
        
    };
}

function getErrorMessage(){
    var error_message = payloadByte[1];
    var err;
    switch (error_message){
        case 01:
            err=constants.Error_message[1];
            break;
        case 02:
            err=constants.Error_message[2];
            break;
        case 03:
            err=constants.Error_message[3];
            break;
        case 04:
            err=constants.Error_message[4];
            break;
        default:
            err="Unknown error";
            break;
    }
    return{
        'Error' : err
    };
}

/**
 * Receiving common telemetry by any value message_type
 * @param payloadByte
 * @param payLoadJson
 * @returns  Json {{ts: *, values: {*}}}
 */
function getTelemetryCommonDown() {
    var mSecUtc = convertDateTimeISO8601_toMsUtc(devEuiLink["Time"]);
    var rez =
        {
            "ts": mSecUtc,
            "values": {
                "m_type": constants.mTypeSpr[devEuiLink['MType']],
                "m_port": devEuiLink['FPort'],
                "m_customerID": devEuiLink['CustomerID'],
                "m_LrrRSSI": devEuiLink["LrrRSSI"],
                "m_LrrSNR": devEuiLink["LrrSNR"],
                "m_Lrrid": devEuiLink["Lrrid"]
            }
        };
    return rez;
}

/**
 * Metadata
 * @returns Headers payload: {deviceType: string, telemetry: string, deviceName: string}
 */
function getPayload() {
    return {
        'deviceName': "",
        'deviceType': payLoadJson.DevEUI_uplink.CustomerData.name,
        'Timestamp': payLoadJson.DevEUI_uplink.Time,
        'telemetry': ""
    }
}


function convertCoordinate(bytes) {
    bytes = bytesToInt(bytes);
    bytes = bytes << 8;
    if (bytes > 0x7FFFFFFF) {                // 2147483647
        bytes = bytes - 0x100000000;        // 4294967296"deviceType": "tracker",
    }
    bytes = bytes / Math.pow(10, 7);
    return bytes;
}


function getVersion(v, v0, vsub) {
    return "V" + v + "." + v0 + "-" + vsub;
}

function hexStringToBytes(str) {
    var array = str.match(/.{1,2}/g);
    var a = [];
    array.forEach(function (element) {
        a.push(parseInt(element, 16));
    });
    return a;
}

function convertDateTimeISO8601_toMsUtc(str) {
    return new Date(str).getTime();
}

function bytesToInt(bytes) {
    var val = 0;
    for (var j = 0; j < bytes.length; j++) {
        val += bytes[j];
        if (j < bytes.length - 1) {
            val = val << 8;
        }
    }
    return val;
}

function decodeToJson(payload) {
    try {
        return JSON.parse(String.fromCharCode.apply(String, payload));
    } catch (e) {
        return JSON.parse(JSON.stringify(payload));
    }
}

function getBit(byte, bitNumber) {
    return ((byte & (1 << bitNumber)) != 0) ? 1 : 0;
}

return result;