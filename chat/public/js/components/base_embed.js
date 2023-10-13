window.frappe = {
    app: {
        handle_session_expired : () => {}
    },
    boot: {
        assets_json: {}
    },
    _messages: {
        'Today': 'Hoje'
    }
};
window.cordova = true;
frappe.ready_events = [];
frappe.ready = function(fn) {
    frappe.ready_events.push(fn);
}

