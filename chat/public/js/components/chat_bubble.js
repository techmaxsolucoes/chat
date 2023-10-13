export default class ChatBubble {
  constructor(parent) {
    this.parent = parent;
    this.setup();
  }

  setup() {
    this.$chat_bubble = $(document.createElement('div'));
    this.open_title = this.parent.is_admin
      ? __('Mostrar chats')
      : __('Fale Conosco');
    this.closed_title = __('Fechar Chat');

    const bubble_visible = this.parent.is_desk === true ? 'd-none' : '';
    this.open_inner_html = `
			<div class='p-3 chat-bubble ${bubble_visible}'>
				<span class='chat-message-icon'>
					<svg xmlns="http://www.w3.org/2000/svg" width="1.1rem" height="1.1rem" viewBox="0 0 24 24"  xmlns="http://www.w3.org/2000/svg">
					  <path d="M12 1c-6.627 0-12 4.364-12 9.749 0 3.131 1.817 5.917 4.64 7.7.868 2.167-1.083 4.008-3.142 4.503 2.271.195 6.311-.121 9.374-2.498 7.095.538 13.128-3.997 13.128-9.705 0-5.385-5.373-9.749-12-9.749z"/>
					</svg>
				</span>
				<div>${this.open_title}</div>
			</div>
		`;
    this.closed_inner_html = `
		<div class='chat-bubble-closed chat-bubble ${bubble_visible}'>
			<span class='cross-icon'>
        <svg class="icon icon-lg" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M3.78033 2.71967C3.48744 2.42678 3.01257 2.42678 2.71967 2.71967C2.42678 3.01256 2.42678 3.48744 2.71967 3.78033L6.94054 8.00119L2.71967 12.2221C2.42678 12.515 2.42678 12.9898 2.71967 13.2827C3.01257 13.5756 3.48744 13.5756 3.78033 13.2827L8.0012 9.06185L12.222 13.2826C12.5149 13.5755 12.9897 13.5755 13.2826 13.2826C13.5755 12.9897 13.5755 12.5148 13.2826 12.222L9.06186 8.00119L13.2826 3.78044C13.5755 3.48755 13.5755 3.01267 13.2826 2.71978C12.9897 2.42688 12.5149 2.42689 12.222 2.71978L8.0012 6.94054L3.78033 2.71967Z" stroke="none" fill="var(--icon-stroke)"></path>
        </svg>
			</span>
		</div>
		`;
    this.$chat_bubble
      .attr({
        title: this.open_title,
        id: 'chat-bubble',
      })
      .html(this.open_inner_html);
  }

  render() {
    this.parent.$app_element.append(this.$chat_bubble);
    this.setup_events();
  }

  change_bubble() {
    this.parent.is_open = !this.parent.is_open;
    if (this.parent.is_open === false) {
      this.$chat_bubble
        .attr({
          title: this.open_title,
        })
        .html(this.open_inner_html);
      this.parent.hide_chat_widget();
    } else {
      this.$chat_bubble
        .attr({
          title: this.closed_title,
        })
        .html(this.closed_inner_html);
      this.parent.show_chat_widget();
    }
  }

  setup_events() {
    const me = this;
    $('#chat-bubble, .chat-cross-button').on('click', () => {
      me.change_bubble();
    });
  }
}
