(() => {
    if($wai.default?.autoLoadJsFile){
        let curPage = (window.location.pathname+'').split("/").pop();
        let pageSrc = './'+curPage.split(".")[0]+'.js';
        const scriptElem = document.createElement('script');
        document.head.appendChild(scriptElem);
        scriptElem.setAttribute('type', 'text/javascript');
        scriptElem.setAttribute('src', pageSrc);
    }
})();