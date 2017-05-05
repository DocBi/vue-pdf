import _ from 'underscore';
import Promise from 'bluebird';
import $ from 'jquery';
var PDFJS = require('pdfjs-dist');
var PdfjsWorker = require('worker-loader!pdfjs-dist/build/pdf.worker.js');
PDFJS.PDFJS.workerPort = new PdfjsWorker();

function PDFJSWrapper(viewer, option = {}, $emit) {
    this.viewer = viewer;
    this.$emit = $emit;
    this.pdfDoc = null;
    this.scale = option.scale || 1;
    this.adaptiveScale = 0;
    this.maxWidth = 0;
    this.src = '';
    this.pdfPageArr = [];
}

_.extend (PDFJSWrapper.prototype, {
    _getAdaptiveScale() {
        if (!this.viewer || !this.maxWidth) return 1;
        return ($(this.viewer).width()) / this.maxWidth;
    },
    _createEmptyPage(pageNum) {
        let template = `<div class="page" id="pageContainer${pageNum}" data-page-number="${pageNum}" data-loaded="false">
                            <div class="canvasWrapper">
                                <canvas id="page${pageNum}"></canvas>
                            </div>
                            <div class="textLayer"></div>
                         </div>`;
        return $(template).get(0);
    },
    _createPage(pageNum, scale) {
        return this.pdfDoc.getPage(pageNum).then(pdfPage => {
            let page = document.getElementById(`pageContainer${pageNum}`);
            let canvas = page.querySelector('canvas');
            let wrapper = page.querySelector('.canvasWrapper');
            let container = page.querySelector('.textLayer');
            let viewport = pdfPage.getViewport(_.isNumber(scale) ? scale : 1);

            if (scale == 'auto') {
                if (!this.adaptiveScale) {
                    viewport.width > this.maxWidth && (this.maxWidth = viewport.width);
                    return;
                } else {
                    viewport = pdfPage.getViewport(this.adaptiveScale);
                }
            }

            canvas.width = viewport.width * 2;
            canvas.height = viewport.height * 2;
            page.style.width = `${viewport.width}px`;
            page.style.height = `${viewport.height}px`;
            wrapper.style.width = `${viewport.width}px`;
            wrapper.style.height = `${viewport.height}px`;
            container.style.width = `${viewport.width}px`;
            container.style.height = `${viewport.height}px`;

            return [pdfPage, viewport];
        });
    },
    _loadPage(pageNum) {
        try {
            var pdfPage = this.pdfPageArr[pageNum - 1][0];
            var viewport = this.pdfPageArr[pageNum - 1][1];
            var page = $(`[data-page-number=${pageNum}]`, this.viewer).get(0);

            let canvas = page.querySelector('canvas');
            let canvasContext = canvas.getContext('2d');
            let container = page.querySelector('.textLayer');


            pdfPage.render({
                canvasContext,
                viewport
            });

            pdfPage.getTextContent().then(textContent => {
                PDFJS.renderTextLayer({
                    textContent,
                    container,
                    viewport,
                    textDivs: []
                });
            });
        } catch(err) {
            console.log(pageNum);
        }
    },
    resetAdaptiveScale() {
        this.adaptiveScale = this._getAdaptiveScale();
    },
    loadDocument(src) {
        this.src = src;
        this.pdfDoc = null;

        this.$emit ('numPages', undefined);
        if (!src) {
            this.canvasEle.removeAttribute ('width');
            this.canvasEle.removeAttribute ('height');
            return;
        }
        var loadingTask = PDFJS.getDocument(src);
        loadingTask.onPassword = (updatePassword, reason) => {
            var reasonStr;
            switch (reason) {
                case PDFJS.PasswordResponses.NEED_PASSWORD:
                    reasonStr = 'NEED_PASSWORD';
                    break;
                case PDFJS.PasswordResponses.INCORRECT_PASSWORD:
                    reasonStr = 'INCORRECT_PASSWORD';
                    break;
            }
            this.$emit ('password', updatePassword, reasonStr);
        };

        loadingTask.onProgress = (status) => {
            var ratio = status.loaded / status.total;
            this.$emit('progress', Math.min (ratio, 1));
        }

        loadingTask.then((pdf) => {
            if (src != this.src) return;
            this.pdfDoc = pdf;
            this.renderPage();
        }).catch ((err) => {

            })
    },
    renderPage() {
        if (!this.pdfDoc) return;
        let numPages = this.pdfDoc.pdfInfo.numPages;
        for (let i = 0; i < numPages; i++) {
            let page = this._createEmptyPage(i+1);
            this.viewer.appendChild(page);
        }
        this.renderPdf();
    },
    renderPdf(scale) {
        //初始化page
        this.pdfPageArr = [];
        $('.page', this.viewer).attr('data-loaded', 'false');
        $(this.viewer).parent().off('scroll');

        var self = this;
        scale = scale || this.scale;
        if (!this.pdfDoc) return;
        let numPages = this.pdfDoc.pdfInfo.numPages;
        let renderPdfArr = [];
        for (let i = 0; i < numPages; i++) {
            renderPdfArr.push(this._createPage(i+1, scale));
        }
        Promise.all(renderPdfArr).then((pdfPageArr) => {
            if (pdfPageArr.some(item => !item)) {
                var adaptiveScale = this.adaptiveScale = this._getAdaptiveScale();
                this.renderPdf(adaptiveScale);
            } else {
                this.pdfPageArr = pdfPageArr;
                this.$emit('loaded', pdfPageArr);
                $(this.viewer).parent().on('scroll', function () {
                    var scrollTop = $(this).scrollTop();
                    var clientHeight = $(this).innerHeight();
                    $('.page[data-loaded=false]', self.viewer).map(function () {
                        var pageNum = this.getAttribute('data-page-number');
                        var top = $(this).position().top;
                        var height = $(this).height();
                        var isTopVisible = top <= scrollTop && top + height > scrollTop;
                        var isBottomVisible = top < scrollTop + clientHeight && top + height > scrollTop + clientHeight;
                        var isMiddleVisible = top > scrollTop && top + height < scrollTop + clientHeight;
                        var isContainVisible = top < scrollTop && top + height > scrollTop + clientHeight;
                        if (isTopVisible || isBottomVisible || isMiddleVisible || isContainVisible) {
                            $(this).attr('data-loaded', 'true');
                            self._loadPage(pageNum);
                        }
                    });
                    for (var pageDom of $('.page', self.viewer).get()) {
                        var pageNum = pageDom.getAttribute('data-page-number');
                        var top = $(pageDom).position().top;
                        var height = $(pageDom).outerHeight(true);
                        var isTopVisible = top <= scrollTop && top + height >= scrollTop;
                        if (isTopVisible) {
                            self.$emit('pageChange', pageNum);
                            break;
                        }
                    }
                });
                $(this.viewer).scroll();
            }
        });
    },
    destroy() {
        $(this.viewer).empty();
        if (this.pdfDoc === null) return;
        this.pdfDoc.destroy();
        this.pdfDoc = null;
        this.adaptiveScale = 0;
        this.maxWidth = 0;
        this.pdfPageArr = [];
        $(this.viewer).parent().off('scroll').scrollTop(0).scrollLeft(0);
    }
});


module.exports = PDFJSWrapper;
