export class ViewManager {
    constructor(container) {
        this.container = container;
        this.currentView = null;
        this.errorHandler = this.defaultErrorHandler;
    }

    setErrorHandler(handler) {
        this.errorHandler = handler;
    }

    defaultErrorHandler(error) {
        console.log('Error loading view: ', error);
        alert(`Une erreur est survenue lors du chargement de la page : ${error.message}`);
    }

    async loadView(jsPath, htmlPath) {
        try {
            if (this.currentView) {
                await this.currentView.cleanupView();
                this.container.innerHTML = '';
            }

            // Charger le HTML et instancier la vue simultanément
            const [htmlContent, ViewClass] = await Promise.all([
                this.fetchHtml(htmlPath),
                this.fetchViewClass(jsPath)
            ]);

            this.currentView = new ViewClass();

            // Injecter le HTML dans l'élément de la vue
            if (htmlContent)
                this.currentView.element.innerHTML = htmlContent;

            this.container.appendChild(this.currentView.element);
            await this.currentView.initView();
            return true;
        } catch (error) {
            this.errorHandler(error);
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
    }

    async initView() {
        // À implémenter dans les classes filles
    }

    async cleanupView() {
        // À implémenter dans les classes filles
    }
}
