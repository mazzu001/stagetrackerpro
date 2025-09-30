(() => {
    const params = scriptQuery();
    let arrLibId = [];
    try{
        let sLoadLib = params?.loadLib ?? '';
        if(sLoadLib.length > 0){
            arrLibId = sLoadLib.split(',');
        }
    }catch(e){}
    //console.log("arrLibId --> ", arrLibId);
    if($wai.default?.libUse === true || $wai.default?.libUse === 'Y'){
        const xmlhttp = new XMLHttpRequest();
        xmlhttp.open("GET", `${$wai.default.libPath}/libInfo.json`, false);
        xmlhttp.send();
        if (xmlhttp.readyState === 4 && xmlhttp.status == "200") {
            try{
                let objContent = JSON.parse(xmlhttp.responseText);
                let projectBase = objContent.PROJECT_BASE;
                if((projectBase?.BOOTSTRAP ?? "") != ""){
                    document.write("<!--wai.library.bootstrap.start-->");
                    let filePath = `${$wai.info.path}/lib/bootstrap.min.js`;
                    if(document.querySelector(`script[src="${filePath}"]`) == null){
                        document.write(`<script type='text/javascript' src='${filePath}'></script>`);
                    }
                    filePath = `${$wai.info.path}/lib/bootstrap.min.css`;
                    if(document.querySelector(`link[href="${filePath}"]`) == null){
                        document.write(`<link rel='stylesheet' type='text/css' href='${filePath}'>`);
                    }
                    $wai.default["useBootstrap"] = "Y";
                    document.write("<!--wai.library.bootstrap.end-->");
                }

                let libInfo = objContent.INFO;
                document.write("<!--wai.library.autoLoad.start-->");
                for(let i in libInfo){
                    if(libInfo[i].AUTO_LOAD_YN == "Y"){
                        genLibScript(libInfo[i]);
                    }
                }
                document.write("<!--wai.library.autoLoad.end-->");
                document.write("<!--wai.library.load.start-->");
                for(let i in libInfo){
                    if(arrLibId.includes(libInfo[i].LIBRARY_ID)){
                        genLibScript(libInfo[i]);
                    }
                }
                document.write("<!--wai.library.load.end-->");
            }catch(e){
                console.log("libInfo.json parse error - ", e);
            }
        }
    }

    function genLibScript(libInfo){
        const filePath = `${$wai.info.path}/lib/library_loader.js?libId=${libInfo.LIBRARY_ID}`;
        let scriptElem = document.querySelector(`script[src="${filePath}"]`);
        if(scriptElem == null){
            document.write(`<script type='text/javascript' src='${filePath}'></script>`);
        }
    }

    function scriptQuery() {
        var script = document.getElementsByTagName('script');
        script = script[script.length-1].src
            .replace(/^[^\?]+\?/, '')
            .replace(/#.+$/, '')
            .split('&');
        var queries = {}
            , query;
        while(script.length){
            query = script.shift().split('=');
            queries[query[0]] = query[1];
        }
        return queries;
    }
})();