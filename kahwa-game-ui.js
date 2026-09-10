(function () {
  'use strict';
  window.kahwaGameUI = {
    renderers: {
      domino: window.kahwaDominoUI,
      tawla: window.kahwaTawlaUI,
      chess: window.kahwaChessUI,
      cards: window.kahwaCardsUI
    },
    current: null,
    mount: function (container, context) {
      var type = (context && context.gameType) || 'domino';
      var R = this.renderers[type] || this.renderers.domino;
      this.current = R;
      if (R && R.mount) R.mount(container, context);
      if (R && R.bindActions) R.bindActions(container, context);
      if (R && R.setLegalActions) R.setLegalActions(context && context.state ? (context.state.legalActions || []) : []);
    },
    render: function (container, state) {
      if (this.current && this.current.render) this.current.render(container, state);
    },
    setLegalActions: function (actions) {
      if (this.current && this.current.setLegalActions) this.current.setLegalActions(actions);
    },
    setLoading: function (value) {
      if (this.current && this.current.setLoading) this.current.setLoading(value);
    },
    showSuccess: function (message) {
      if (this.current && this.current.showSuccess) this.current.showSuccess(message);
    },
    showError: function (message) {
      if (this.current && this.current.showError) this.current.showError(message);
    },
    destroy: function () {
      if (this.current && this.current.destroy) this.current.destroy();
      this.current = null;
    }
  };
})();
