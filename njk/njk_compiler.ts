import * as fs from 'fs/promises'
import * as path from 'path'
import * as nj from 'nunjucks'

const filesystem = {
  PATH_TEMPLATES_ROOT: 'njk',
  PATH_TEMPLATES_IN: 'njk/templates',
  PATH_TEMPLATES_OUT: '.'
}

function main() {
  // compiler environment
  return new Promise((res) => {
    console.log('info init compiler env')
    res(new nj.Environment(
      new nj.FileSystemLoader(),
      {
        autoescape: false
      }
    )) 
  })
  // load template files
  .then((env: nj.Environment) => {
    console.log(`info load template files from ${filesystem.PATH_TEMPLATES_IN}`)
    return fs.readdir(filesystem.PATH_TEMPLATES_IN, {
      recursive: true,
      withFileTypes: true
    })
    .then((t_files) => {
      console.log(`debug found ${t_files.length} entries in ${filesystem.PATH_TEMPLATES_IN}`)
      return {env, t_files}
    })
  })
  // render template files and write out
  .then(({env, t_files}) => {
    return Promise.all(t_files.map((t_file) => {
      if (t_file.isFile() && t_file.path.split('/').indexOf('lib') === -1) {
        let out_file = path.join(t_file.path, t_file.name).substring(filesystem.PATH_TEMPLATES_IN.length)
        console.log(`write ${out_file} to ${filesystem.PATH_TEMPLATES_OUT}`)

        return fs.mkdir(path.dirname(path.join(filesystem.PATH_TEMPLATES_OUT, out_file)), {recursive: true})
        .then(() => {
          return fs.writeFile(
            path.join(filesystem.PATH_TEMPLATES_OUT, out_file), 
            env.render(path.join(t_file.path, t_file.name))
          )
        })
      }
      else {
        console.log(`${t_file.name} is not a compiled file. skip`)
        return Promise.resolve(undefined)
      }
    }))
  })
  // end
  .then((fs_writes) => {
    console.log(`finished compiling ${fs_writes.length} template files`)
  })
}

// always assumes called as entrypoint script
main()
