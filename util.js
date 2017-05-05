function isDataSchema(url) {
    var i = 0, ii = url.length;
    while (i < ii && url[i].trim() === '') {
        i++;
    }
    return url.substr(i, 5).toLowerCase() === 'data:';
}

function getPDFFileNameFromURL(url, defaultFilename = 'document.pdf') {
    if (isDataSchema(url)) {
        console.warn('getPDFFileNameFromURL: ' +
            'ignoring "data:" URL for performance reasons.');
        return defaultFilename;
    }
    var reURI = /^(?:(?:[^:]+:)?\/\/[^\/]+)?([^?#]*)(\?[^#]*)?(#.*)?$/;
    //            SCHEME        HOST         1.PATH  2.QUERY   3.REF
    // Pattern to get last matching NAME.pdf
    var reFilename = /[^\/?#=]+\.pdf\b(?!.*\.pdf\b)/i;
    var splitURI = reURI.exec(url);
    var suggestedFilename = reFilename.exec(splitURI[1]) ||
        reFilename.exec(splitURI[2]) ||
        reFilename.exec(splitURI[3]);
    if (suggestedFilename) {
        suggestedFilename = suggestedFilename[0];
        if (suggestedFilename.indexOf('%') !== -1) {
            // URL-encoded %2Fpath%2Fto%2Ffile.pdf should be file.pdf
            try {
                suggestedFilename =
                    reFilename.exec(decodeURIComponent(suggestedFilename))[0];
            } catch (e) { // Possible (extremely rare) errors:
                // URIError "Malformed URI", e.g. for "%AA.pdf"
                // TypeError "null has no properties", e.g. for "%2F.pdf"
            }
        }
    }
    return suggestedFilename || defaultFilename;
}

export {
    getPDFFileNameFromURL
};