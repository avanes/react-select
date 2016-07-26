'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _ = require('lodash'),
    React = require('react'),
    ReactDOM = require('react-dom'),
    Input = require('react-input-autosize'),
    classes = require('classnames'),
    Value = require('./Value');

var requestId = 0;

var Select = React.createClass({

  displayName: 'Select',

  propTypes: {
    value: React.PropTypes.any, // initial field value
    multi: React.PropTypes.bool, // multi-value input
    options: React.PropTypes.array, // array of options
    delimiter: React.PropTypes.string, // delimiter to use to join multiple values
    asyncOptions: React.PropTypes.func, // function to call to get options
    autoload: React.PropTypes.bool, // whether to auto-load the default async options set
    placeholder: React.PropTypes.string, // field placeholder, displayed when there's no value
    noResultsText: React.PropTypes.string, // placeholder displayed when there are no matching search results
    clearable: React.PropTypes.bool, // should it be possible to reset value
    clearValueText: React.PropTypes.string, // title for the "clear" control
    clearAllText: React.PropTypes.string, // title for the "clear" control when multi: true
    searchPromptText: React.PropTypes.string, // label to prompt for search input
    name: React.PropTypes.string, // field name, for hidden <input /> tag
    onChange: React.PropTypes.func, // onChange handler: function(newValue) {}
    className: React.PropTypes.string, // className for the outer element
    filterOption: React.PropTypes.func, // method to filter a single option: function(option, filterString)
    filterOptions: React.PropTypes.func, // method to filter the options array: function([options], filterString, [values])
    matchPos: React.PropTypes.string, // (any|start) match the start or entire string when filtering
    matchProp: React.PropTypes.string, // (any|label|value) which option property to filter on

    asyncMinLength: React.PropTypes.number, // minimum input length for async options load
    sendSameValue: React.PropTypes.bool, // send value if not changed
    minInputWidth: React.PropTypes.number // minimum input width
  },

  getDefaultProps: function getDefaultProps() {
    return {
      value: undefined,
      options: [],
      delimiter: ",",
      asyncOptions: undefined,
      autoload: true,
      placeholder: "Выбрать...",
      noResultsText: "Ничего не найдено",
      clearable: true,
      clearValueText: "Очистить",
      clearAllText: "Очистить все",
      searchPromptText: "Поиск",
      name: undefined,
      onChange: undefined,
      className: undefined,
      matchPos: "any",
      matchProp: "any",

      asyncMinLength: 3,
      sendSameValue: false,
      minInputWidth: 5
    };
  },

  getInitialState: function getInitialState() {
    return {
      /*
       * set by getStateFromValue on componentWillMount:
       * - value
       * - values
       * - filteredOptions
       * - inputValue
       * - placeholder
       * - focusedOption
      */
      options: this.props.options,
      isFocused: false,
      isOpen: this.props.isOpen || false,
      isLoading: false
    };
  },

  componentWillMount: function componentWillMount() {
    this._optionsCache = {};
    this._optionsFilterString = '';
    this.setState(this.getStateFromValue(this.props.value));

    if (this.props.asyncOptions && this.props.autoload) {
      this.autoloadAsyncOptions();
    }
  },

  componentDidMount: function componentDidMount() {
    this._mounted = true;
    if (this.state.isOpen) {
      this.setState({ inputValue: this.props.placeholder });
      this.refs.input.focus();
    }
  },

  componentWillUnmount: function componentWillUnmount() {
    clearTimeout(this._blurTimeout);
    clearTimeout(this._focusTimeout);
    clearTimeout(this._hackBlurTimeout);
    this._mounted = false;
  },

  componentWillReceiveProps: function componentWillReceiveProps(newProps) {
    if (newProps.value !== this.state.value) {
      this.setState(this.getStateFromValue(newProps.value, newProps.options));
    }
    if (JSON.stringify(newProps.options) !== JSON.stringify(this.props.options)) {
      this.setState({
        options: newProps.options,
        filteredOptions: this.filterOptions(newProps.options)
      });
    }
  },

  componentDidUpdate: function componentDidUpdate() {
    if (this._focusAfterUpdate) {
      clearTimeout(this._blurTimeout);
      this._focusTimeout = setTimeout((function () {
        if (this.refs.input) {
          this.refs.input.focus();
          this._focusAfterUpdate = false;
        }
      }).bind(this), 50);
    }

    if (this._focusedOptionReveal) {
      if (this.refs.focused && this.refs.menu) {
        var focusedDOM = this.refs.focused;
        var menuDOM = this.refs.menu;
        var focusedRect = focusedDOM.getBoundingClientRect();
        var menuRect = menuDOM.getBoundingClientRect();

        if (focusedRect.bottom > menuRect.bottom || focusedRect.top < menuRect.top) {
          menuDOM.scrollTop = focusedDOM.offsetTop + focusedDOM.clientHeight - menuDOM.offsetHeight;
        }
      }

      this._focusedOptionReveal = false;
    }
  },

  getStateFromValue: function getStateFromValue(value, options) {

    if (!options) {
      options = this.state.options;
    }

    // reset internal filter string
    this._optionsFilterString = '';

    var values = this.initValuesArray(value, options),
        filteredOptions = this.filterOptions(options, values);

    return {
      value: values.map(function (v) {
        return v.value;
      }).join(this.props.delimiter),
      values: values,
      inputValue: '',
      filteredOptions: filteredOptions,
      placeholder: !this.props.multi && values.length ? values[0].label : this.props.placeholder,
      focusedOption: !this.props.multi && values.length ? values[0] : filteredOptions[0]
    };
  },

  initValuesArray: function initValuesArray(values, options) {

    if (!Array.isArray(values)) {
      if ('string' === typeof values) {
        values = values.split(this.props.delimiter);
      } else {
        values = values ? [values] : [];
      }
    }

    return values.map((function (val) {
      return 'string' === typeof val ? val = _.find(options, { value: val }) || { value: val, label: val } : val;
    }).bind(this));
  },

  setValue: function setValue(value) {
    this._focusAfterUpdate = true;
    var newState = this.getStateFromValue(value);
    newState.isOpen = false;
    this.fireChangeEvent(newState);
    this.setState(newState);
  },

  selectValue: function selectValue(value) {
    if (!this.props.multi) {
      this.setValue(value);
      // hack: blur input
      this._hackBlurTimeout = setTimeout((function () {
        if (this.isMounted()) {
          var input = ReactDOM.findDOMNode(this).querySelector('input');
          if (input !== null) {
            input.blur();
          }
        }
      }).bind(this), 150);
    } else if (value) {
      this.addValue(value);
    }
  },

  addValue: function addValue(value) {
    this.setValue(this.state.values.concat(value));
  },

  popValue: function popValue() {
    this.setValue(_.initial(this.state.values));
  },

  removeValue: function removeValue(value) {
    this.setValue(_.without(this.state.values, value));
  },

  clearValue: function clearValue(event) {
    // if the event was triggered by a mousedown and not the primary
    // button, ignore it.
    if (event && event.type == 'mousedown' && event.button !== 0) {
      return;
    }

    // hack: revert cleared value on blur
    var inputValue;
    if (this.state.inputValue !== "") {
      inputValue = this.state.inputValue;
    } else if (this.state.placeholder !== "") {
      inputValue = this.state.placeholder;
    }
    this.setState({
      clearedValue: this.state.value,
      clearedInputValue: inputValue
    });

    this.setValue(null);
  },

  resetValue: function resetValue() {
    this.setValue(this.state.value);
  },

  fireChangeEvent: function fireChangeEvent(newState) {
    if (newState.value !== "" && this.props.onChange) {
      if (this.props.sendSameValue || newState.value !== this.state.value) {
        this.props.onChange(newState.value, newState.values);
      }
    }
  },

  handleMouseDown: function handleMouseDown(event) {
    // if the event was triggered by a mousedown and not the primary
    // button, ignore it.
    if (event.type == "mousedown" && event.button !== 0) {
      return;
    }
    event.stopPropagation();
    if (event.target.className === "Select-control") {
      var input = this.refs.input.refs.input;
      input.value = input.value;
      event.preventDefault();
    }
    if (this.state.isFocused) {
      this.setState({
        isOpen: true
      });
    } else {
      this._openAfterFocus = true;
      this.refs.input.focus();
    }
  },

  handleInputFocus: function handleInputFocus() {
    this.setState({
      isFocused: true,
      isOpen: this.state.isOpen || this._openAfterFocus
    });
    this._openAfterFocus = false;
  },

  handleInputBlur: function handleInputBlur(event) {
    this._blurTimeout = setTimeout((function () {
      if (this._focusAfterUpdate) return;
      this.setState({
        isOpen: false,
        isFocused: false
      });

      // hack: save cleared values
      if (this.state.value === "" && this.state.inputValue === "") {
        this.setState({
          value: this.state.clearedValue,
          inputValue: this.state.clearedInputValue
        });
      }
    }).bind(this), 50);
  },

  handleKeyDown: function handleKeyDown(event) {

    switch (event.keyCode) {

      case 8:
        // backspace
        if (!this.state.inputValue) {
          this.popValue();
        }
        return;
        break;

      case 9:
        // tab
        if (event.shiftKey || !this.state.isOpen || !this.state.focusedOption) {
          return;
        }
        this.selectFocusedOption();
        break;

      case 13:
        // enter
        this.selectFocusedOption();
        break;

      case 27:
        // escape
        if (this.state.isOpen) {
          this.resetValue();
        } else {
          this.clearValue();
        }
        break;

      case 38:
        // up
        this.focusPreviousOption();
        break;

      case 40:
        // down
        this.focusNextOption();
        break;

      default:
        return;
    }

    event.preventDefault();
  },

  handleInputChange: function handleInputChange(event) {

    // assign an internal variable because we need to use
    // the latest value before setState() has completed.
    this._optionsFilterString = event.target.value;

    if (this.props.asyncOptions) {
      if (event.target.value.length >= this.props.asyncMinLength) {
        this.setState({
          isLoading: true,
          inputValue: event.target.value
        });
        this.loadAsyncOptions(event.target.value, {
          isLoading: false,
          isOpen: true
        });
      } else {
        this.setState({
          isLoading: false,
          inputValue: event.target.value
        });
      }
    } else {
      var filteredOptions = this.filterOptions(this.state.options);
      this.setState({
        isOpen: true,
        inputValue: event.target.value,
        filteredOptions: filteredOptions,
        focusedOption: _.includes(filteredOptions, this.state.focusedOption) ? this.state.focusedOption : filteredOptions[0]
      });
    }
  },

  autoloadAsyncOptions: function autoloadAsyncOptions() {
    this.loadAsyncOptions('', {}, function () {});
  },

  loadAsyncOptions: function loadAsyncOptions(input, state) {

    for (var i = 0; i <= input.length; i++) {
      var cacheKey = input.slice(0, i);
      if (this._optionsCache[cacheKey] && (input === cacheKey || this._optionsCache[cacheKey].complete)) {
        var options = this._optionsCache[cacheKey].options;
        if (this._mounted) {
          this.setState(_.extend({
            options: options,
            filteredOptions: this.filterOptions(options)
          }, state));
        }
        return;
      }
    }

    var thisRequestId = this._currentRequestId = requestId++;

    this.props.asyncOptions(input, (function (err, data) {
      this._optionsCache[input] = data;

      if (thisRequestId !== this._currentRequestId) {
        return;
      }

      if (this._mounted) {
        this.setState(_.extend({
          options: data.options,
          filteredOptions: this.filterOptions(data.options)
        }, state));
      }
    }).bind(this));
  },

  filterOptions: function filterOptions(options, values) {
    var filterValue = this._optionsFilterString;
    var exclude = (values || this.state.values).map(function (i) {
      return i.value;
    });
    if (this.props.filterOptions) {
      return this.props.filterOptions.call(this, options, filterValue, exclude);
    } else {
      var filterOption = _.bind(function (op) {
        if (this.props.multi && _.includes(exclude, op.value)) return false;
        if (this.props.filterOption) return this.props.filterOption.call(this, op, filterValue);
        return !filterValue || this.props.matchPos === "start" ? this.props.matchProp !== "label" && op.value.toLowerCase().substr(0, filterValue.length) === filterValue || this.props.matchProp !== "value" && op.label.toLowerCase().substr(0, filterValue.length) === filterValue : this.props.matchProp !== "label" && op.value.toLowerCase().indexOf(filterValue.toLowerCase()) >= 0 || this.props.matchProp !== "value" && op.label.toLowerCase().indexOf(filterValue.toLowerCase()) >= 0;
      }, this);
      return _.filter(options, filterOption, this);
    }
  },

  selectFocusedOption: function selectFocusedOption() {
    return this.selectValue(this.state.focusedOption);
  },

  focusOption: function focusOption(op) {
    this.setState({
      focusedOption: op
    });
  },

  focusNextOption: function focusNextOption() {
    this.focusAdjacentOption('next');
  },

  focusPreviousOption: function focusPreviousOption() {
    this.focusAdjacentOption('previous');
  },

  focusAdjacentOption: function focusAdjacentOption(dir) {
    this._focusedOptionReveal = true;

    var ops = this.state.filteredOptions;

    if (!this.state.isOpen) {
      this.setState({
        isOpen: true,
        inputValue: '',
        focusedOption: this.state.focusedOption || ops[dir === 'next' ? 0 : ops.length - 1]
      });
      return;
    }

    if (!ops.length) {
      return;
    }

    var focusedIndex = -1;

    for (var i = 0; i < ops.length; i++) {
      if (this.state.focusedOption === ops[i]) {
        focusedIndex = i;
        break;
      }
    }

    var focusedOption = ops[0];

    if (dir === 'next' && focusedIndex > -1 && focusedIndex < ops.length - 1) {
      focusedOption = ops[focusedIndex + 1];
    } else if (dir === 'previous') {
      if (focusedIndex > 0) {
        focusedOption = ops[focusedIndex - 1];
      } else {
        focusedOption = ops[ops.length - 1];
      }
    }

    this.setState({
      focusedOption: focusedOption
    });
  },

  unfocusOption: function unfocusOption(op) {
    if (this.state.focusedOption === op) {
      this.setState({
        focusedOption: null
      });
    }
  },

  buildMenu: function buildMenu() {

    var focusedValue = this.state.focusedOption ? this.state.focusedOption.value : null;

    var ops = _.map(this.state.filteredOptions, (function (op) {
      var isFocused = focusedValue === op.value;

      var optionClass = classes({
        "Select-option": true,
        "is-focused": isFocused
      });

      var ref = isFocused ? "focused" : null;

      var mouseEnter = this.focusOption.bind(this, op),
          mouseLeave = this.unfocusOption.bind(this, op),
          mouseDown = this.selectValue.bind(this, op);

      return React.createElement(
        'div',
        { ref: ref, key: 'option-' + op.value, className: optionClass, onMouseEnter: mouseEnter, onMouseLeave: mouseLeave, onMouseDown: mouseDown, onClick: mouseDown },
        op.label
      );
    }).bind(this), this);

    return ops.length ? ops : React.createElement(
      'div',
      { className: 'Select-noresults' },
      this.props.asyncOptions && !this.state.inputValue ? this.props.searchPromptText : this.props.noResultsText
    );
  },

  render: function render() {

    var selectClass = classes('Select', this.props.className, {
      'is-multi': this.props.multi,
      'is-open': this.state.isOpen,
      'is-focused': this.state.isFocused,
      'is-loading': this.state.isLoading,
      'has-value': this.state.value
    });

    var value = [];

    if (this.props.multi) {
      this.state.values.forEach(function (val) {
        var props = _.extend({
          key: val.value,
          onRemove: this.removeValue.bind(this, val)
        }, val);
        value.push(React.createElement(Value, props));
      }, this);
    }

    if (!this.state.inputValue && (!this.props.multi || !value.length)) {
      value.push(React.createElement(
        'div',
        { className: 'Select-placeholder', key: 'placeholder' },
        this.state.placeholder
      ));
    }

    var loading = this.state.isLoading ? React.createElement('span', { className: 'Select-loading', 'aria-hidden': 'true' }) : null;
    var clear = this.props.clearable && this.state.isOpen && (this.state.value || this.state.inputValue) ? React.createElement('span', { className: 'Select-clear', title: this.props.multi ? this.props.clearAllText : this.props.clearValueText, 'aria-label': this.props.multi ? this.props.clearAllText : this.props.clearValueText, onMouseDown: this.clearValue, onClick: this.clearValue, dangerouslySetInnerHTML: { __html: '' } }) : null;
    var menu = this.state.isOpen ? React.createElement(
      'div',
      { ref: 'menu', onMouseDown: this.handleMouseDown, className: 'Select-menu' },
      this.buildMenu()
    ) : null;

    var commonProps = {
      ref: 'input',
      className: 'Select-input',
      tabIndex: this.props.tabIndex || 0,
      onFocus: this.handleInputFocus,
      onBlur: this.handleInputBlur,
      minWidth: this.props.minInputWidth
    };
    var input = React.createElement(Input, _extends({ value: this.state.inputValue, onChange: this.handleInputChange }, commonProps));

    return React.createElement(
      'div',
      { ref: 'wrapper', className: selectClass },
      React.createElement('input', { type: 'hidden', ref: 'value', name: this.props.name, value: this.state.value }),
      React.createElement(
        'div',
        { className: 'Select-control', ref: 'control', onKeyDown: this.handleKeyDown, onMouseDown: this.handleMouseDown, onTouchEnd: this.handleMouseDown },
        value,
        input,
        loading,
        clear
      ),
      menu
    );
  }

});

module.exports = Select;