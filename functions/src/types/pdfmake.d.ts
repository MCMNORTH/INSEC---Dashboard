declare module 'pdfmake' {
    interface OutputDocument {
        getBuffer(): Promise<Buffer>;
    }
    const pdfmake: {
        setFonts(fonts: Record<string, Record<string, string>>): void;
        setUrlAccessPolicy(callback: (url: string) => boolean): void;
        setLocalAccessPolicy(callback: (path: string) => boolean): void;
        createPdf(definition: Record<string, unknown>): OutputDocument;
    };
    export default pdfmake;
}
