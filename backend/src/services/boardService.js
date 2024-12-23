import { slugify } from '~/utils/formatters'
import { boardModel } from '~/models/boardModel'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import { cloneDeep } from 'lodash'
import { columnModel } from '~/models/columnModel'
import { cardModel } from '~/models/cardModel'
import { DEFAULT_PAGE, DEFAULT_ITEMS_PER_PAGE } from '~/utils/constants'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { ObjectId } from 'mongodb'

const createNew = async (userId, reqBody, backgroundImage) => {
  try {
    let backgroundUrl = null
    if (backgroundImage) {
      backgroundUrl = await await CloudinaryProvider.streamUpload(backgroundImage.buffer, 'board-covers')
    }

    const newBoard = {
      ...reqBody,
      slug: slugify(reqBody.title),
      backgroundImageUrl: backgroundUrl ? backgroundUrl.secure_url : null
    }

    // Gọi tới Model để xử lý lưu bản ghi newBoard vào Database
    const createdBoard = await boardModel.createNew(userId, newBoard)

    // Lấy bản ghi board sau khi gọi
    const getNewBoard = await boardModel.findOneById(createdBoard.insertedId)

    // Trả kết quả về Controller, trong Service luôn cần có return
    return getNewBoard
  } catch (error) {
    throw error
  }
}

const getDetails = async (userId, boardId) => {
  try {
    const board = await boardModel.getDetails(userId, boardId)
    if (!board) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found')
    }

    // Sử dụng cloneDeep để tạo ra một bản sao của object board mà thao tác trên bản sao không ảnh hưởng đến object ban đầu
    // // https://www.javascripttutorial.net/javascript-primitive-vs-reference-values/
    const resBoard = cloneDeep(board)
    // Đưa card về đúng column của nó
    resBoard.columns.forEach(column => {
      column.cards = resBoard.cards.filter(card => card.columnId.equals(column._id))
    })

    // Xóa mảng cards khỏi Board ban đầu
    delete resBoard.cards

    // Trả kết quả về Controller, trong Service luôn cần có return
    return resBoard
  } catch (error) {
    throw error
  }
}

const update = async (boardId, reqBody, backgroundImage) => {
  try {
    if (backgroundImage) {
      const backgroundUrl = await CloudinaryProvider.streamUpload(backgroundImage.buffer, 'board-covers')
      reqBody.backgroundImageUrl = backgroundUrl.secure_url
    }

    if (reqBody.labels) {
      reqBody.labels = reqBody.labels.map(label => {
        return {
          ...label,
          _id: label._id || new ObjectId().toString()
        }
      })
    }

    const updateData = {
      ...reqBody,
      updatedAt: Date.now()
    }

    const updatedBoard = await boardModel.update(boardId, updateData)

    return updatedBoard
  } catch (error) {
    throw error
  }
}

const moveCardToDifferentColumn = async (reqBody) => {
  try {
    // B1: Cập nhật mảng cardOrderIds của column cũ (xóa _id của Card ra khỏi mảng)
    await columnModel.update(reqBody.prevColumnId, {
      cardOrderIds: reqBody.prevCardOrderIds,
      updatedAt: Date.now()
    })

    // B2: Cập nhật mảng cardOrderIds của column mới (thêm _id của Card vào mảng)
    await columnModel.update(reqBody.nextColumnId, {
      cardOrderIds: reqBody.nextCardOrderIds,
      updatedAt: Date.now()
    })
    // B3: Cập nhật columnId của Card đã kéo
    await cardModel.update(reqBody.currentCardId, {
      columnId: reqBody.nextColumnId,
      updatedAt: Date.now()
    })

    return { updateResult: 'Successfully' }
  } catch (error) {
    throw error
  }
}

const getBoards = async (userId, page, itemsPerPage, queryFilters) => {
  try {
    // Nếu không tồn tại page hoặc itemsPerPage từ phía FE thì BE sẽ cần phải luôn gán giá trị mặc định
    if (!page) page = DEFAULT_PAGE
    if (!itemsPerPage) itemsPerPage = DEFAULT_ITEMS_PER_PAGE

    const results = await boardModel.getBoards(
      userId,
      parseInt(page, 10),
      parseInt(itemsPerPage, 10),
      queryFilters
    )

    return results
  } catch (error) { throw error }
}

const deleteBoard = async (userId, boardId) => {
  try {
    // Check if the board exists before attempting to delete it
    const board = await boardModel.getDetails(userId, boardId)
    if (!board) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found')
    }

    // Delete the board
    const deletionResult = await boardModel.deleteBoard(userId, boardId)
    // Return a success message or relevant data
    return { message: 'Board successfully deleted', deletionResult }
  } catch (error) {
    throw error
  }
}

export const boardService = {
  createNew,
  getDetails,
  update,
  moveCardToDifferentColumn,
  getBoards,
  deleteBoard
}
