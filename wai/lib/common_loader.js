let common_module_load = false;
function convert(buffer , name) {
    return new Promise(function(resolve, reject){
        var object = new Blob(["<script>" +buffer +"</script>"] ,  {
            type: 'text/html',
            endings: 'native'
        });
        const objectURL = URL.createObjectURL(object);
        let inframe = document.createElement("iframe");
        inframe.onload = function(a,b){
            window[name] = this.contentWindow;
            //console.log(name, this.contentWindow);
            URL.revokeObjectURL(objectURL);
            resolve();
        };
        inframe.src = objectURL;
        document.head.appendChild(inframe);
    });
}

function sendAjaxRequest(url,method) {
    return new Promise(function(resolve, reject){
        let xhr = new XMLHttpRequest();
        xhr.onload = function() {
            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                resolve(xhr.response);
            } else {
                reject({status : xhr.status, statusText : xhr.statusText});
            }
        }
        xhr.open('GET',url,true);
        xhr.responseType = 'text';
        xhr.send();
    });
}

function fetch(url ) {
    return new Promise(function(resolve, reject){
        let xhr = new XMLHttpRequest();
        xhr.onload = function() {
            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                resolve(xhr.response);
            } else {
                reject({status : xhr.status, statusText : xhr.statusText});
            }
        }
        xhr.open('GET',url,true);
        xhr.responseType = 'text';
        xhr.send();
    });
}

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

function documentReady() {
    return new Promise(function(resolve, reject){
        function timeoutStep () {
            if (common_module_load) resolve()
            else setTimeout(timeoutStep, 100)
        }
        timeoutStep();
    });
}

(async function () {
    if ($wai.default.common_module_load_type == undefined || $wai.default.common_module_load_type == 0) return;

    var modules_path = $wai.default.common_module_path;
    let list = [];
    await sendAjaxRequest(modules_path + "/modules.list", "GET").then((response) => {
        //  console.log(response);
        list = response.split("\r\n");
    }).then((response) => {

    }).catch((errorMsg) => {
        console.log(errorMsg);
    });
    for (var idx in list) {
        list[idx] = list[idx].replace("\r\n", "");
        if(list[idx].trim() == "") continue;
        //global loading
        if ($wai.default.common_module_load_type == 1) {
            function module_load_check(target, name){
                if (target[name] == undefined) {
                    setTimeout(function () {
                        module_load_check(name)
                    }, 100);
                } else {
                    window[name] = target[name];
                }
            }
            if(opener != undefined){
                module_load_check(opener.window.top, list[idx]);
            }else{
                if(window.top != window.self) module_load_check(window.top, list[idx]);
                else {
                    if (window[list[idx]] == undefined) {
                        let ret = "";
                        await fetch(modules_path + "/" + list[idx] + ".js" ).then((response) => {
                            ret =  response;
                        });
                        await convert(ret , list[idx]);
                    }
                }
            }
        } else if ($wai.default.common_module_load_type == 2) {
            let ret = "";
            await fetch(modules_path + "/" + list[idx] + ".js" ).then((response) => {
                ret =  response;
            });
            await convert(ret , list[idx]);
        }
    }
    common_module_load= true;
}());

