// frappe.Chat
// Author - Maxwell Morais <mmorais@techmaxsolucoes.com.br>

import './components/base_embed';
import '../../../../frappe/frappe/public/js/frappe-web.bundle.js';
import '../../../../frappe/frappe/public/js/frappe/request';
import './components/socketio_client';


import {
    ChatBubble,
    ChatList,
    ChatSpace as BaseChatSpace,
    ChatWelcome,
    get_settings,
    scroll_to_bottom,
  } from './components';
import {
  is_image
} from './components/chat_utils';

frappe.provide('frappe.Chat');
frappe.provide('frappe.Chat.settings');

frappe.call = function (opts) {
	if (!frappe.is_online()) {
		frappe.show_alert(
			{
				indicator: "orange",
				message: __("Connection Lost"),
				subtitle: __("You are not connected to Internet. Retry after sometime."),
			},
			3
		);
		opts.always && opts.always();
		return $.ajax();
	}
	if (typeof arguments[0] === "string") {
		opts = {
			method: arguments[0],
			args: arguments[1],
			callback: arguments[2],
			headers: arguments[3],
		};
	}

	if (opts.quiet) {
		opts.no_spinner = true;
	}
	var args = $.extend({}, opts.args);

	if (args.freeze) {
		opts.freeze = opts.freeze || args.freeze;
		opts.freeze_message = opts.freeze_message || args.freeze_message;
	}

	// cmd
	if (opts.module && opts.page) {
		args.cmd = opts.module + ".page." + opts.page + "." + opts.page + "." + opts.method;
	} else if (opts.doc) {
		$.extend(args, {
			cmd: "run_doc_method",
			docs: frappe.get_doc(opts.doc.doctype, opts.doc.name),
			method: opts.method,
			args: opts.args,
		});
	} else if (opts.method) {
		args.cmd = opts.method;
	}

	var callback = function (data, response_text) {
		if (data.task_id) {
			// async call, subscribe
			frappe.realtime.subscribe(data.task_id, opts);

			if (opts.queued) {
				opts.queued(data);
			}
		} else if (opts.callback) {
			// ajax
			return opts.callback(data, response_text);
		}
	};

	let url = opts.url;
	if (!url) {
		url = "/api/method/" + args.cmd;
		if (frappe.request.url) {
			let host = frappe.request.url;
			host = host.slice(0, host.length - 1);
			url = host + url;
		}
		delete args.cmd;
	}

	// debouce if required
	if (opts.debounce && frappe.request.is_fresh(args, opts.debounce)) {
		return Promise.resolve();
	}

	return frappe.request.call({
		type: opts.type || "POST",
		args: args,
		success: callback,
		error: opts.error,
		always: opts.always,
		btn: opts.btn,
		freeze: opts.freeze,
		freeze_message: opts.freeze_message,
		headers: opts.headers || {},
		error_handlers: opts.error_handlers || {},
		// show_spinner: !opts.no_spinner,
		async: opts.async,
		silent: opts.silent,
		url,
	});
};

class ChatSpace extends BaseChatSpace {
  constructor(opts){
    super(opts);
    this.server = opts.server;
  }

  make_message(content, time, type, name) {
    const message_class =
      type === 'recipient' ? 'recipient-message' : 'sender-message';
    const $recipient_element = $(document.createElement('div')).addClass(
      message_class
    );
    const $message_element = $(document.createElement('div')).addClass(
      'message-bubble'
    );

    const $name_element = $(document.createElement('div'))
      .addClass('message-name')
      .text(name);

    const n = content.lastIndexOf('/');
    const file_name = content.substring(n + 1) || '';
    let $sanitized_content;

    if (content.startsWith('/files/') && file_name !== '') {
      let $url;
      if (is_image(file_name)) {
        $url = $(document.createElement('img'));
        $url.attr({ src: `${this.server}${content}` }).addClass('img-responsive chat-image');
        $message_element.css({ padding: '0px', background: 'inherit' });
        $name_element.css({
          color: 'var(--text-muted)',
          'padding-bottom': 'var(--padding-xs)',
        });
      } else {
        $url = $(document.createElement('a'));
        $url.attr({ href: content, target: '_blank' }).text(__(file_name));

        if (type === 'sender') {
          $url.css('color', 'var(--cyan-100)');
        }
      }
      $sanitized_content = $url;
    } else {
      $sanitized_content = __($('<div>').text(content).html());
    }

    if (type === 'sender' && this.profile.room_type === 'Group') {
      $message_element.append($name_element);
    }
    $message_element.append($sanitized_content);
    $recipient_element.append($message_element);
    $recipient_element.append(`<div class='message-time'>${__(time)}</div>`);

    return $recipient_element;
  }

  upload_file(file) {
    const me = this;
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('load', () => {
        resolve();
      });

      xhr.addEventListener('error', () => {
        reject(frappe.throw(__('Erro Interno do Servidor')));
      });
      xhr.onreadystatechange = () => {
        if (xhr.readyState == XMLHttpRequest.DONE) {
          if (xhr.status === 200) {
            let r = null;
            let file_doc = null;
            try {
              r = JSON.parse(xhr.responseText);
              if (r.message.doctype === 'File') {
                file_doc = r.message;
              }
            } catch (e) {
              r = xhr.responseText;
            }
            try {
              if (file_doc === null) {
                reject(frappe.throw(__('Carregamento do Arquivo Falhou!')));
              }
              me.handle_send_message(file_doc.file_url);
            } catch (error) {
              //pass
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              const messages = JSON.parse(error._server_messages || 'null');
              const errorObj = JSON.parse(messages[0]);
              reject(frappe.throw(__(errorObj.message)));
            } catch (e) {
              // pass
            }
          }
        }
      };

      xhr.open('POST', `${this.server}/api/method/upload_file`, true);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('X-Frappe-CSRF-Token', frappe.csrf_token);

      let form_data = new FormData();

      form_data.append('file', file.file_obj, file.name);
      form_data.append('is_private', +false);

      form_data.append('doctype', 'Chat Room');
      form_data.append('docname', this.profile.room);
      form_data.append('optimize', +true);
      xhr.send(form_data);
    });
  }
}


  /** Spawns a chat widget on any web page */
  frappe.Chat = class {
    constructor() {
      this.setup_params();
      this.setup_app();
    }

    /** Get basic app params from the Script tag */
    setup_params(){
        let script = document.getElementById('frappe-chat');
        this.server = script.src.split("assets/chat/")[0];
        frappe.request.url = this.server;
        if (this.server.indexOf('localhost') !== -1){
          window.dev_server = true;
        }
    }
  
    /** Create all the required elements for chat widget */
    create_app() {

      this.$wrapper = $(document.createElement('div'));
      this.$wrapper.attr('id', '#chat');
      $(document.body).append(this.$wrapper);

      this.$app_element = $(document.createElement('div'));
      this.$app_element.addClass('chat-app');
      this.$chat_container = $(document.createElement('div'));
      this.$chat_container.addClass('chat-container');
      this.$wrapper.append(this.$app_element);
      this.is_open = false;
  
      this.$chat_element = $(document.createElement('div'))
        .addClass('chat-element')
        .hide();
  
      this.$chat_element.append(`
              <span class="chat-cross-button">
                <svg class="icon icon-lg" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M3.78033 2.71967C3.48744 2.42678 3.01257 2.42678 2.71967 2.71967C2.42678 3.01256 2.42678 3.48744 2.71967 3.78033L6.94054 8.00119L2.71967 12.2221C2.42678 12.515 2.42678 12.9898 2.71967 13.2827C3.01257 13.5756 3.48744 13.5756 3.78033 13.2827L8.0012 9.06185L12.222 13.2826C12.5149 13.5755 12.9897 13.5755 13.2826 13.2826C13.5755 12.9897 13.5755 12.5148 13.2826 12.222L9.06186 8.00119L13.2826 3.78044C13.5755 3.48755 13.5755 3.01267 13.2826 2.71978C12.9897 2.42688 12.5149 2.42689 12.222 2.71978L8.0012 6.94054L3.78033 2.71967Z" stroke="none" fill="var(--icon-stroke)"></path>
                </svg>
              </span>
          `);
      this.$chat_element.append(this.$chat_container);
      this.$chat_element.appendTo(this.$app_element);
  
      this.chat_bubble = new ChatBubble(this);
      this.chat_bubble.render();
  
      const navbar_icon_html = `
          <li class='nav-item dropdown dropdown-notifications 
            dropdown-mobile chat-navbar-icon' title="Mostrar Chats" >
            ${frappe.utils.icon('small-message', 'md')}
            <span class="badge" id="chat-notification-count"></span>
          </li>
      `;
  
      if (this.is_desk === true) {
        $('header.navbar > .container > .navbar-collapse > ul').prepend(
          navbar_icon_html
        );
      }
      this.setup_events();
    }
  
    /** Load dependencies and fetch the settings */
    async setup_app() {
      try {
        const token = localStorage.getItem('guest_token') || '';
        const res = await get_settings(token);
        this.is_admin = res.is_admin;
        this.is_desk = 'desk' in frappe;
  
        if (res.enable_chat === false || (!this.is_desk && this.is_admin)) {
          return;
        }
  
        this.create_app();
        await frappe.socketio.init(this.server.replace('http', 'ws'), res.socketio_port, true);
  
        frappe.Chat.settings = {};
        frappe.Chat.settings.user = res.user_settings;
        frappe.Chat.settings.unread_count = 0;
  
        if (res.is_admin) {
          // If the user is admin, render everthing
          this.chat_list = new ChatList({
            $wrapper: this.$chat_container,
            user: res.user,
            user_email: res.user_email,
            is_admin: res.is_admin,
          });
          this.chat_list.render();
        } else if (res.is_verified) {
          // If the token and ip address matches, directly render the chat space
          this.chat_space = new ChatSpace({
            server: this.server,
            $wrapper: this.$chat_container,
            profile: {
              room_name: res.guest_title,
              room: res.room,
              is_admin: res.is_admin,
              user: res.user,
              user_email: res.user_email,
            },
          });
        } else {
          //Render the welcome screen if the user is not verified
          this.chat_welcome = new ChatWelcome({
            $wrapper: this.$chat_container,
            profile: {
              name: res.guest_title,
              is_admin: res.is_admin,
              chat_status: res.chat_status,
            },
          });
          this.chat_welcome.render();
        }
      } catch (error) {
        console.error(error);
      }
    }
  
    /** Shows the chat widget */
    show_chat_widget() {
      this.is_open = true;
      this.$chat_element.fadeIn(250);
      if (typeof this.chat_space !== 'undefined') {
        scroll_to_bottom(this.chat_space.$chat_space_container);
      }
    }
  
    /** Hides the chat widget */
    hide_chat_widget() {
      this.is_open = false;
      this.$chat_element.fadeOut(300);
    }
  
    should_close(e) {
      const chat_app = $('.chat-app');
      const navbar = $('.navbar');
      const modal = $('.modal');
      return (
        !chat_app.is(e.target) &&
        chat_app.has(e.target).length === 0 &&
        !navbar.is(e.target) &&
        navbar.has(e.target).length === 0 &&
        !modal.is(e.target) &&
        modal.has(e.target).length === 0
      );
    }
  
    setup_events() {
      const me = this;
      $('.chat-navbar-icon').on('click', function () {
        me.chat_bubble.change_bubble();
      });
  
      $(document).mouseup(function (e) {
        if (me.should_close(e) && me.is_open === true) {
          me.chat_bubble.change_bubble();
        }
      });
    }
  };

frappe.ready(() => {
    new frappe.Chat();
});