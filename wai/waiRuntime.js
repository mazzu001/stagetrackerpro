/**
 *  [ wai ] Loader
 *
 *  Copyright(C) 2017 Corebank Co.,Ltd. All rights reserved.
 */
var $waiIntegrated = true;
(function(){
    const params = scriptQuery();
    const sLoadLib = params?.loadLib ?? '';
    const sIdeYn = params?.isWaiIDE ?? 'N';
    const sTopPageYn = params?.isTopPage ?? 'N';
    const sAutoCallJsYn = params.autoCallJS ?? 'Y';

    var rootUrl = '/wai';
    var loadFiles = [];

    if($waiIntegrated){
        loadFiles = [
            {
                'url'   :'/waiCompuser.info.js',
                'cache': false
            },
            {
                'url'   :'/lib/jquery.min.js',
                'cache': false
            },
            {
                'url'   :'/waiAll.css',
                'cache': true
            },
            {
                'url'   :'/waiAll.js',
                'cache': true
            },
            {
                'url'   :'/waiSettings.info.js',
                'cache': false
            },
            {
                'url'   :'/lib/waiRTL.min.js',
                'cache': true
            }
        ];
    }else{
        loadFiles = [
            {
                'url'   :'/Y[wai]/wai.js',
                'cache': true
            }
        ];
    }
    document.write("<!--wai.loader.start-->");

    var dt = new Date();
    var ca = '';

    for (var i=0;i<loadFiles.length;i++){
        ca = loadFiles[i].cache ? '' : '?nocache='+dt.toString();
        var ext = getExtensionOfFilename(loadFiles[i].url);

        if(ext == ".js") {
            document.write('<script type="text/javascript" src="' + rootUrl + loadFiles[i].url + ca + '"></script>');
        }
        else if(ext == ".css") {
            document.write('<link rel="stylesheet" type="text/css" href="' + rootUrl + loadFiles[i].url + ca + '">');
        }
    }

    if(sIdeYn == 'Y' && sTopPageYn == 'N'){
        document.write(`<script type="text/javascript">if($wai.default?.libUse) $wai.default.libUse = false;</script>`);
    }

    let sLoadLibScript = '/wai/lib/library_auto_loader.js';
    if(sLoadLib.length > 0){
        sLoadLibScript += `?loadLib=${sLoadLib}`;
    }
    document.write(`<script type='text/javascript' src='${sLoadLibScript}'></script>`);
    document.write("<!--wai.loader.end-->");

    if(sIdeYn == 'N'){
        // Y[wai] Library : showModalDialog 기능을 대체하는 JavaScript
        if(this.showModalDialogSupported=!0,this.popupWrapper=document.createElement("div"),this.popupWrapper.style="position:absolute; left:0px; top:0px;width:100%;height:100%;background-color:rgba(194,194,194, 0.2);z-index:99999;",!window.showModalDialog){showModalDialogSupported=!1;var returnVal="",newFunction='async function(arg1, arg2, arg3, arg4) {\t    var url = "";\t\tif(arg1.startsWith("/")){ url = window.location.origin + arg1;}        else if(arg1.startsWith(".")){          const pathSegments = window.location.href.split("/");          pathSegments.pop();          const pathWithoutFileName = pathSegments.join("/");          url = pathWithoutFileName + "/" + arg1;         }\t\tvar w;\t\tvar h;\t\tvar resizable = "no";\t\tvar scroll = "no";\t\tvar status = "no";\t\tvar mdattrs = arg3.split(";");\t\tfor (i = 0; i < mdattrs.length; i++) {\t\t\tvar mdattr = mdattrs[i].replace(":","=").split("=");\t\t\tvar n = mdattr[0];\t\t\tvar v = mdattr[1];\t\t\tif (n) {\t\t\t\tn = n.trim().toLowerCase();\t\t\t}\t\t\tif (v) {\t\t\t\tv = v.trim().toLowerCase();\t\t\t}\t\t\tif (n == "dialogheight") {\t\t\t\th = v.replace("px", "");\t\t\t} else if (n == "dialogwidth") {\t\t\t\tw = v.replace("px", "");\t\t\t} else if (n == "resizable") {\t\t\t\tresizable = v;\t\t\t} else if (n == "scroll") {\t\t\t\tscroll = v;\t\t\t} else if (n == "status") {\t\t\t\tstatus = v;\t\t\t} else {\t\t\t}\t\t}\t\tvar left = window.screenX + (window.outerWidth / 2) - (w / 2);\t\tvar top = window.screenY + (window.outerHeight / 2) - (h / 2);\t\tvar targetWin = window.open(url, "ShowModalDialog " + arg1, "toolbar=no, location=no, directories=no, status=" + status +  \t\t\t", menubar=no, scrollbars=" + scroll + ", resizable=" + resizable + ", copyhistory=no, width=" + w\t+                  \t\t\t", height=" + h + ", top=" + top + ", left=" + left);                                                                  \t\tif(targetWin && targetWin.closed){\t\t\talert("Please turn off the pop-up blocker.");\t\t\treturn;\t\t}\t\tif(arg4 != undefined)  arg4.targetWin = targetWin;\t\tdialogArguments = arg2;\t\tthis.popupWrapper.addEventListener("mousedown", function(){targetWin.focus();} );\t\twindow.top.document.body.appendChild(this.popupWrapper);\t\ttargetWin.focus();\t\tlet retVal = await new Promise(function (resolve) {\t\t\tre = function showModalDialogCallback(e) {\t\t\t\treturn resolve(e);\t\t\t};\t\t});\t\twindow.top.document.body.removeChild(this.popupWrapper);\t\treturn retVal;\t};';if(window.showModalDialog=new Function("return "+newFunction)(),window.removeEventListener("beforeunload",(function(){dlg_closed(returnVal)})),window.addEventListener("beforeunload",(function(){dlg_closed(returnVal)})),window.getDialogArgumentsInner=function(){return"undefined"!=typeof dialogArguments?dialogArguments:void 0},null==opener||opener.closed||void 0===opener.showModalDialogSupported){if(null!=parent.opener&&!parent.opener.closed&&void 0!==parent.opener.showModalDialogSupported)try{window.dialogArguments=parent.opener.getDialogArgumentsInner(),parent.window.dialogArguments=window.dialogArguments}catch(t){console.error("There was an error processing the popup. \nError contents : "+t)}}else try{window.dialogArguments=opener.getDialogArgumentsInner()}catch(t){console.error("There was an error processing the popup. \nError contents : "+t)}Object.defineProperty(window,"returnValue",{set:function(t){setReturnValue(t)},configurable:!0})}function setReturnValue(t){returnVal=t}var h_closed=!1;function dlg_closed(t){if(!h_closed&&(h_closed=!0,0==showModalDialogSupported))if(null==opener||opener.closed||void 0===opener.showModalDialogSupported){if(null!=parent.opener&&!parent.opener.closed&&void 0!==parent.opener.showModalDialogSupported)try{parent.opener.showModalDialogCallback(t)}catch(t){console.error("There was an error processing the popup. \nError contents : "+t)}}else try{opener.showModalDialogCallback(t)}catch(t){console.error("There was an error processing the popup. \nError contents : "+t)}}function getDialogArguments(){};
        document.write("<script type='text/javascript' src='/wai/lib/common_loader.js'></script>");
        if (sAutoCallJsYn != 'N') {
            document.write("<script type='text/javascript' src='/wai/lib/javascript_auto_loader.js'></script>");
        }
    }

    document.write(`<script type="text/javascript" src="${rootUrl}/lib/waiDataIO_loader.js?isTopPage=${sTopPageYn}"></script>`);

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
