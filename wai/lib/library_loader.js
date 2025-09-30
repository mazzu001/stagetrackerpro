(() => {
    const params = scriptQuery();
    if($wai.default?.libUse === true || $wai.default?.libUse === 'Y'){
        const xmlhttp = new XMLHttpRequest();
        xmlhttp.open("GET", `${$wai.default.libPath}/libInfo.json`, false);
        xmlhttp.send();
        if (xmlhttp.readyState === 4 && xmlhttp.status == "200") {
            let content = xmlhttp.responseText;
            let libInfo = JSON.parse(content).INFO;
            let libElem = libInfo.find(elem => elem.LIBRARY_ID == params.libId);
            if(libElem !== null){
                const useComp = params.useComp ?? 'N';
                if(useComp == 'Y'){
                    //console.log("-------lib load end-------", libElem.LIBRARY_ID, Object.keys($.prototype));
                    if(Object.keys(parent?.parent ?? {}).length > 1) {
                        if (parent?.parent?.addLibComp !== undefined && parent?.parent?.$libComponentList !== undefined && parent?.parent?.setCurJqKey !== undefined) {
                            scriptLoaded(libElem, parent?.parent?.arrCurJqKey);
                        }
                    }
                }else{
                    //console.log("-------lib load start-------", libElem.LIBRARY_ID, Object.keys($.prototype));
                    let fileInfo = (libElem.FILE ?? []).filter(elem => elem?.IMPORT_YN == 'Y');
                    for(let j in fileInfo){
                        let sFilePath = "/lib/" + libElem.LIBRARY_ID + "/" + fileInfo[j].FILE_NAME;
                        let sFileExt = getExtensionOfFilename(fileInfo[j].FILE_NAME);
                        if(sFileExt == ".js") {
                            if(document.querySelector(`script[src="${sFilePath}"]`) == null){
                                document.write(`<script type='text/javascript' src='${sFilePath}'></script>`);
                            }
                        }
                        else if(sFileExt == ".css") {
                            if(document.querySelector(`link[href="${sFilePath}"]`) == null){
                                document.write(`<link rel='stylesheet' type='text/css' href='${sFilePath}'>`);
                            }
                        }
                    }
                    if($wai.default.libInfo === undefined){
                        $wai.default["libInfo"] = [];
                    }
                    $wai.default.libInfo.push(libElem);
                    if(Object.keys(parent?.parent ?? {}).length > 1) {
                        if (parent?.parent?.addLibComp !== undefined && parent?.parent?.$libComponentList !== undefined && parent?.parent?.setCurJqKey !== undefined) {
                            parent?.parent?.setCurJqKey(Object.keys($.prototype));
                            const loaderFilePath = `/wai/lib/library_loader.js?libId=${libElem.LIBRARY_ID}&useComp=Y`;
                            let loaderScriptElem = document.querySelector(`script[src="${loaderFilePath}"]`);
                            if (loaderScriptElem == null) {
                                document.write(`<script type='text/javascript' src='${loaderFilePath}'></script>`);
                            }
                        }
                    }
                }
            }
        }
    }

    function scriptLoaded(libInfo, arrOrgJqKey){
        //console.log("scriptLoaded --> ", libInfo, arrOrgJqKey, Object.keys($.prototype));
        if(Object.keys(parent?.parent ?? {}).length > 1){
            let arrJqKey = [];
            if(["03", "04"].includes(libInfo.LIBRARY_TYPE_ID)) { // 03 : jQuery Plug-in, 04 : jQuery Based Library
                const orgKeySize = arrOrgJqKey.length;
                const curKeySize = Object.keys($.prototype).length;
                if(orgKeySize < curKeySize){
                    arrJqKey = Object.keys($.prototype).slice(orgKeySize - curKeySize);
                }
            }
            //console.log("arrJqKey --> ", arrJqKey);
            let arrUseComp = (libInfo.USE_COMP ?? []).map(elem => elem.COMP_NAME);
            arrJqKey = arrJqKey.filter(key => arrUseComp.includes(key));
            if (parent?.parent?.addLibComp !== undefined && parent?.parent?.$libComponentList !== undefined && parent?.parent?.setCurJqKey !== undefined) {
                parent?.parent?.addLibComp(libInfo, arrJqKey);
            }
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

    function getExtensionOfFilename(filename) {

        var _fileLen = filename.length;

        /**
         * lastIndexOf('.')
         * 뒤에서부터 '.'의 위치를 찾기위한 함수
         * 검색 문자의 위치를 반환한다.
         * 파일 이름에 '.'이 포함되는 경우가 있기 때문에 lastIndexOf() 사용
         */
        var _lastDot = filename.lastIndexOf('.');

        // 확장자 명만 추출한 후 소문자로 변경
        var _fileExt = filename.substring(_lastDot, _fileLen).toLowerCase();

        return _fileExt;
    }

})();