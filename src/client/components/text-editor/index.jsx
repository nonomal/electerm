/**
 * default text editor for remote file
 */

import React from 'react'
import fs from '../../common/fs'
import _ from 'lodash'
import {
  Form, Button, Input,
  Spin,
  Modal
} from 'antd'
import { validateFieldsAndScroll } from '../../common/dec-validate-and-scroll'
import resolve from '../../common/resolve'
import { typeMap } from '../../common/constants'

const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const c = prefix('common')
const s = prefix('sftp')

export class TextEditorForm extends React.PureComponent {
  state = {
    text: '',
    path: 'loading...',
    loading: true
  }

  componentDidMount () {
    if (this.props.visible) {
      this.fetchText()
    }
  }

  componentWillUnmount () {
    this.watcher &&
    this.watcher.close &&
    this.watcher.close()
  }

  fetchText = async () => {
    this.setState({
      loading: true
    })
    const {
      sftpFunc,
      file: {
        path,
        name,
        type
      }
    } = this.props
    const p = resolve(path, name)
    this.setState({
      path: p
    })
    const sftp = sftpFunc()
    const isRemote = typeMap.remote === type
    const text = isRemote
      ? await this.startDownload(sftp, this.props.file)
      : await fs.readFile(p)
    if (!isRemote) {
      this.setState({
        text: text || '',
        loading: false
      }, this.props.form.resetFields)
    }
  }

  startDownload = (sftp, file) => {
    const localPath = resolve(
      window.getGlobal('tempDir'), file.name
    )
    const remotePath = resolve(file.path, file.name)
    this.remotePath = remotePath
    this.localPath = localPath
    this.file = file
    return new Promise((resolve, reject) => {
      const opts = {
        remotePath,
        localPath,
        options: {
          mode: file.mode
        },
        onData: () => null,
        onError: reject,
        onEnd: resolve
      }
      sftp.download(opts)
    })
      .then(() => this.openFile(localPath))
      .catch(this.props.store.onError)
  }

  openFile = (filePath) => {
    fs.openFile(filePath)
      .then(() => {
        this.watcher = fs.watch(filePath, (eventname, filename) => {
          if (eventname === 'change') {
            this.upload()
          }
        })
      })
      .catch(this.props.store.onError)
  }

  upload = async () => {
    return new Promise((resolve, reject) => {
      const opts = {
        ..._.pick(this, [
          'remotePath',
          'localPath'
        ]),
        options: {
          mode: this.file.mode
        },
        onData: () => null,
        onError: reject,
        onEnd: resolve
      }
      this.props.sftp.download(opts)
    })
      .then(this.cancel)
      .catch(this.props.store.onError)
  }

  handleSubmit = async (evt) => {
    evt.preventDefault()
    const res = await this.validateFieldsAndScroll()
    if (!res) {
      return
    }
    this.setState({
      loading: true
    })
    if (res.text === this.state.text) {
      return this.cancel()
    }
    const {
      sftpFunc,
      file: {
        type,
        mode
      }
    } = this.props
    const sftp = sftpFunc()
    const r = typeMap.remote === type
      ? await sftp.writeFile(
        this.state.path,
        res.text,
        mode
      )
      : await fs.writeFile(
        this.state.path,
        res.text,
        mode
      )
    r && this.props.afterWrite()
    this.cancel()
  }

  cancel = () => {
    this.props.modifier({
      textEditorProps: {}
    })
  }

  onPressEnter = e => {
    e.stopPropagation()
  }

  renderForm () {
    const {
      text
    } = this.state
    const { getFieldDecorator } = this.props.form
    return (
      <Form
        onSubmit={this.handleSubmit}
        layout='vertical'
      >
        <FormItem>
          {getFieldDecorator('text', {
            initialValue: text
          })(
            <Input.TextArea rows={20} onPressEnter={this.onPressEnter}>{text}</Input.TextArea>
          )}
        </FormItem>
      </Form>
    )
  }

  renderFooter () {
    const { loading } = this.state
    return (
      <div>
        <Button
          type='primary'
          className='mg1r'
          disabled={loading}
          onClick={this.handleSubmit}
        >{e('save')}</Button>
        <Button
          type='ghost'
          className='mg1r'
          disabled={loading}
          onClick={() => this.props.form.resetFields()}
        >{s('reset')}</Button>
        <Button
          type='ghost'
          onClick={this.cancel}
          disabled={loading}
          className='mg2r'
        >{c('cancel')}</Button>
      </div>
    )
  }

  render () {
    const { visible } = this.props
    if (!visible) {
      return null
    }
    const { path, loading } = this.state
    const title = `${s('edit')} ${s('remote')} ${s('file')}: ${path}`
    const props = {
      footer: this.renderFooter(),
      title,
      maskClosable: false,
      onCancel: this.cancel,
      width: '90%',
      visible
    }
    return (
      <Modal
        {...props}
      >
        <Spin spinning={loading}>
          {this.renderForm()}
        </Spin>
      </Modal>
    )
  }
}

@Form.create()
@validateFieldsAndScroll
class TextEditor extends TextEditorForm {}

export default TextEditor
