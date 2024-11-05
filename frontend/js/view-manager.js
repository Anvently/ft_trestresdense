import { userManager } from "./home.js";

export class ViewManager {
    constructor(container) {
        this.container = container;
        this.currentView = null;
        this.errorHandler = this.defaultErrorHandler;
        this.successHandler = this.defaultSuccessHandler;
    }

    setSuccessHandler(handler) {
        this.successHandler = handler;
    }

    defaultSuccessHandler(msg) {
        console.log(msg);
    }

    setErrorHandler(handler) {
        this.errorHandler = handler;
    }

    defaultErrorHandler(error) {
        alert(`Une erreur est survenue lors du chargement de la page : ${error.message}`);
    }

    async loadView(jsPath, htmlPath) {
        try {
            if (this.currentView) {
                await this.currentView.cleanupView();
                userManager.clearUsers();
                userManager.setDynamicUpdateHandler(undefined);
                this.container.innerHTML = '';
            }

            // Charger le HTML et instancier la vue simultanément
            const [htmlContent, ViewClass] = await Promise.all([
                this.fetchHtml(htmlPath),
                this.fetchViewClass(jsPath)
            ]);

            this.currentView = new ViewClass();
            this.currentView.setErrorHandler(this.errorHandler);
            this.currentView.setSuccessHandler(this.successHandler);

            // Injecter le HTML dans l'élément de la vue
            if (htmlContent)
                this.currentView.element.innerHTML = htmlContent;

            this.container.appendChild(this.currentView.element);
            await this.currentView.initView();
            return true;
        } catch (error) {
            this.errorHandler(error);
            // throw error
            return false;
        }
    }

    async fetchHtml(path) {
        if (path === undefined)
            return undefined
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load HTML for view: ${path}`);
        }
        return await response.text();
    }

    async fetchViewClass(path) {
        const module = await import(path);
        if (!module.default) {
            throw new Error(`No default export found in view module: ${path}`);
        }
        return module.default;
    }

}

export class BaseView {
    constructor(name) {
        this.name = name;
        this.element = document.createElement('div');
        this.element.id = name;
        this.errorHandler = this.defautErrorHandler;
        this.successHandler = this.defautSuccessHandler;
        this.urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    }

    defautErrorHandler() {

    }

    defautSuccessHandler() {
        
    }

    setErrorHandler(handler) {
        this.errorHandler = handler;
    }

    setSuccessHandler(handler) {
        this.successHandler = handler;
    }

    async initView() {

        // À implémenter dans les classes filles
    }

    async cleanupView() {
        // À implémenter dans les classes filles
    }
}


export class ComponentView extends BaseView {

    constructor() {
        super('');
        this.errorHandler = this.defautErrorHandler;
        this.successHandler = this.defautSuccessHandler;
        this.element = undefined;
        this.htmlContent = '';
    }

    async init(parentContainer) {
        this.element = parentContainer;
        this.element.innerHTML = this.htmlContent;
    }

    async cleanup() {
        this.element.innerHTML = '';
    }

    async refresh() {

    }

}