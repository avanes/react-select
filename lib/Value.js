'use strict';

var _ = require('lodash'),
    React = require('react'),
    classes = require('classnames');

var Option = React.createClass({

	displayName: 'Value',

	propTypes: {
		label: React.PropTypes.string.isRequired
	},

	blockEvent: function blockEvent(event) {
		event.stopPropagation();
	},

	render: function render() {
		return React.createElement(
			'div',
			{ className: 'Select-item' },
			React.createElement(
				'span',
				{ className: 'Select-item-icon', onMouseDown: this.blockEvent, onClick: this.props.onRemove, onTouchEnd: this.props.onRemove },
				'×'
			),
			React.createElement(
				'span',
				{ className: 'Select-item-label' },
				this.props.label
			)
		);
	}

});

module.exports = Option;