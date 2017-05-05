<style lang="less" src="./style.less"></style>
<template>
    <div id="pdf-viewer-wrapper">
        <div id="viewer" class="pdf-viewer"></div>
        <div class="pdf-opt">
            <div class="pdf-title">
                {{title}}
            </div>
            <div class="pdf-jump">
                <input type="text" v-model="nowPage" @blur="onJumpPage">
                /
                <span>{{pageAmount}}</span>
            </div>
            <div class="pdf-scale">
                <select v-model="scale">
                    <option :value="item[0]" v-for="item of scaleList">{{item[1]}}</option>
                </select>
            </div>
        </div>
        <resize-sensor @resize="resize"></resize-sensor>
    </div>
</template>

<script>
    import {getPDFFileNameFromURL} from './util';
    var resizeSensor = require('vue-resize-sensor');
    var PDFJSWrapper = require('./main.js');

    module.exports = {
        components: {
            'resize-sensor': resizeSensor,
        },
        data() {
            return {
                loading: null,
                scale: 'auto',
                scaleList: [
                    ['auto', '自动缩放'],
                    [0.6, '60%'],
                    [0.8, '80%'],
                    [1, '100%'],
                    [1.25, '125%'],
                    [1.5, '150%'],
                    [2, '200%'],
                    [4, '400%']
                ],
                resizeTimer: null,
                nowPage: 0,
                toPage: 0,
                pageAmount: 0
            };
        },
        props: {
            src: {
                type: [String, Object],
                default: '',
            },
            title: {
                type: String,
                default: '',
            },
            page: {
                type: Number,
                default: 1,
            },
            rotate: {
                type: Number,
                default: 0,
            }
        },
        watch: {
            src: function() {
                this.pdf.destroy();
                this.pdf.loadDocument(this.src);
                this.nowPage = 0;
                this.toPage = 0;
                this.pageAmount = 0;
                this.loading.visible = true
            },
            scale: function () {
                this.loading.visible = true;
                this.pdf && this.pdf.renderPdf(this.scale);
            },
            rotate: function() {
            },
        },
        methods: {
            loadPdf() {
                //$load是挂载在Vue上的一个等待条
                this.loading = this.$load({target: this.$el, temp: 'spinner5'});
                this.pdf = new PDFJSWrapper(this.$el.querySelector('#viewer.pdf-viewer'), {scale: this.scale}, this.$emit.bind(this));
                this.$on('loaded', function(pdfPageArr) {
                    this.pageAmount = pdfPageArr.length;
                    this.loading.visible = false;
                });
                this.$on('error', function(err) {
                    this.loading.visible = false;
                    this.$emit('error', err);
                });
                this.$on('pageChange', function (page) {
                    page && (this.nowPage = this.toPage = page);
                });
                this.pdf.loadDocument(this.src);
            },
            resize: function(size) {
                clearTimeout(this.resizeTimer);
                this.resizeTimer = setTimeout(() => {
                    if (this.pdf && this.pdf.maxWidth) {
                        this.pdf.resetAdaptiveScale();
                        this.scale == 'auto' && this.pdf.renderPdf(this.scale);
                    }
                }, 200);
            },
            onJumpPage(ev) {
                if (this.nowPage != this.toPage) {
                    if (this.nowPage > this.pageAmount) {
                        this.nowPage = this.pageAmount;
                    }
                    var top = $(`#viewer .page[data-page-number=${this.nowPage}]`).position().top;
                    $('#pdf-viewer-wrapper').scrollTop(top + 10);
                }
            }
        },
        mounted: function() {
            this.loadPdf();
            var timer = null;
            $(this.$el).scroll(function () {
                clearTimeout(timer);
                var top = this.scrollTop;
                var left = this.scrollLeft;
                $('.pdf-opt', this).css({top, left});
//                $('.pdf-opt', this).css({display: 'none', top: '-30px'});
//                timer = setTimeout(() => {
//                    $('.pdf-opt', this).css({left, display: 'block'}).stop().animate({top}, {duration: 200});
//                }, 200);
            });
        },
        destroyed: function() {
            this.pdf.destroy();
        }
    }
</script>